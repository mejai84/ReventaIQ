"use server";

import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analyzeOpportunity, type OpportunityAnalysis, type OpportunityEngineInput, type SaleChannel } from "@/modules/opportunities/domain";
import { isCondition, isSaleChannel, parseEvaluationPolicy } from "./policy";

const idSchema = z.string().regex(/^\d+$/).transform(BigInt);
const actionSchema = z.object({ supplierOfferId: idSchema });
type EvaluationContext = { input: OpportunityEngineInput; salesProfileByChannel: ReadonlyMap<SaleChannel, bigint>; marketListings: readonly { id: bigint; price: Decimal; conditionGrade: { code: string }; isComparable: boolean }[] };

function asJson(value: unknown): Prisma.InputJsonValue {
  if (Decimal.isDecimal(value)) return value.toString();
  if (Array.isArray(value)) return value.map(asJson);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, asJson(item)]));
  return value as Prisma.InputJsonValue;
}

async function buildContext(userId: bigint, offerId: bigint): Promise<{ context?: EvaluationContext; errors: string[] }> {
  const now = new Date().toISOString();
  const [offer, settings, exchangeRate] = await Promise.all([
    prisma.supplierOffer.findFirst({ where: { id: offerId, createdByUserId: userId, status: "ACTIVE" }, include: { conditionGrade: true } }),
    prisma.businessSettings.findFirst({ where: { userId, isActive: true }, orderBy: { version: "desc" } }),
    prisma.exchangeRate.findFirst({ where: { createdByUserId: userId, baseCurrencyCode: "USD", quoteCurrencyCode: "COP" }, orderBy: [{ observedAt: "desc" }, { id: "desc" }] }),
  ]);
  const errors: string[] = [];
  if (offer === null) return { errors: ["La oferta no existe, no es tuya o ya no está activa."] };
  if (offer.currencyCode !== "USD") errors.push("La oferta debe estar expresada en USD para el motor actual.");
  if (!isCondition(offer.conditionGrade.code)) errors.push("El grado de condición de la oferta debe usar un código compatible con el motor.");
  if (offer.usShipping === null || offer.usSalesTax === null || offer.paymentFee === null) errors.push("Confirma envío USA, impuesto USA y comisión de pago; un cero conocido debe registrarse como 0.");
  if (settings === null) errors.push("Falta una versión activa de configuración de negocio.");
  if (exchangeRate === null) errors.push("Falta una tasa USD/COP observada.");
  if (errors.length > 0 || settings === null || exchangeRate === null || !isCondition(offer.conditionGrade.code) || offer.usShipping === null || offer.usSalesTax === null || offer.paymentFee === null) return { errors };
  let policy;
  try { policy = parseEvaluationPolicy(settings.scoreConfig, settings.signalRules); } catch { return { errors: ["La política JSON activa no cumple el contrato del motor. Revísala en Configuración."] }; }
  const [quotes, listings, profiles, exposure] = await Promise.all([
    prisma.shippingQuote.findMany({ where: { createdByUserId: userId, supplierOfferId: offer.id, currencyCode: "COP" }, include: { shippingProvider: true }, orderBy: [{ quotedAt: "desc" }, { id: "desc" }] }),
    prisma.marketListing.findMany({ where: { createdByUserId: userId, productVariantId: offer.productVariantId, conditionGradeId: offer.conditionGradeId }, include: { salesChannel: true, conditionGrade: true }, orderBy: [{ observedAt: "desc" }, { id: "desc" }] }),
    prisma.salesCostProfile.findMany({ where: { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] }, include: { salesChannel: true }, orderBy: [{ salesChannelId: "asc" }, { version: "desc" }] }),
    prisma.opportunity.aggregate({ where: { status: "ACTIVE", supplierOffer: { productVariantId: offer.productVariantId } }, _sum: { capitalRequiredCop: true } }),
  ]);
  const eligibleQuotes = quotes.filter((quote) => quote.estimatedDeliveryDays !== null && quote.insurance !== null && quote.customs !== null && quote.vat !== null && quote.nationalization !== null && quote.localDelivery !== null);
  if (eligibleQuotes.length === 0) errors.push("Falta una cotización COP completa con días estimados para esta oferta.");
  const usableListings = listings.filter((listing) => listing.isComparable && listing.status === "ACTIVE" && listing.salesChannel !== null && isSaleChannel(listing.salesChannel.code) && isCondition(listing.conditionGrade.code));
  if (usableListings.length === 0) errors.push("Faltan comparables activos de la misma variante, condición y canal de venta.");
  const profileByChannel = new Map<SaleChannel, bigint>();
  for (const profile of profiles) if (isSaleChannel(profile.salesChannel.code) && !profileByChannel.has(profile.salesChannel.code)) profileByChannel.set(profile.salesChannel.code, profile.id);
  const channels = new Set(usableListings.map((listing) => listing.salesChannel!.code as SaleChannel));
  for (const value of channels) {
    if (!profileByChannel.has(value)) errors.push(`Falta un perfil vigente de costos de venta para ${value}.`);
    if (policy.marketSignals[value] === undefined) errors.push(`Faltan señales de mercado configuradas para ${value}.`);
  }
  if (settings.initialCapitalCop.lessThanOrEqualTo(0)) errors.push("El capital inicial de la configuración debe ser mayor que cero.");
  if (errors.length > 0) return { errors };
  const salesChannels = [...channels].map((value) => {
    const profile = profiles.find((item) => item.id === profileByChannel.get(value))!;
    return { channel: value, percentageCosts: [{ code: "SELLING_FEE", label: "Comisión de venta", rate: profile.sellingFeeRate, timing: "AT_SALE" as const, countsAsEconomicCost: true }, { code: "WITHHOLDING", label: "Retención", rate: profile.withholdingRate, timing: "AT_SALE" as const, countsAsEconomicCost: true }], fixedCosts: [{ code: "FIXED_FEE", label: "Cargo fijo", amountCOP: profile.fixedFeeCop, timing: "AT_SALE" as const, countsAsEconomicCost: true }, { code: "CHANNEL_SHIPPING", label: "Envío comercial", amountCOP: profile.shippingCostCop, timing: "AT_SALE" as const, countsAsEconomicCost: true }, { code: "ADVERTISING", label: "Publicidad", amountCOP: profile.advertisingCostCop, timing: "AT_SALE" as const, countsAsEconomicCost: true }, { code: "OTHER_SALES_COST", label: "Otros costos de venta", amountCOP: profile.otherCostCop, timing: "AT_SALE" as const, countsAsEconomicCost: true }] };
  });
  const method = settings.conservativePriceStrategy === "MEDIAN_DISCOUNT" ? "MEDIAN" as const : "NEAREST_RANK_PERCENTILE" as const;
  const expectedDaysToSell = Object.fromEntries([...channels].map((value) => [value, policy.marketSignals[value].expectedDaysToSell ?? settings.defaultExpectedDaysToSell]));
  if (Object.values(expectedDaysToSell).some((value) => value === undefined)) return { errors: ["Faltan días esperados de venta por canal o un valor predeterminado en Configuración."] };
  return { errors, context: { salesProfileByChannel: profileByChannel, marketListings: usableListings, input: { offer: { id: offer.id.toString(), productVariantId: offer.productVariantId.toString(), supplierId: offer.supplierId.toString(), condition: offer.conditionGrade.code, purchasePriceUSD: offer.purchasePrice, usShippingUSD: offer.usShipping, usSalesTaxUSD: offer.usSalesTax, paymentFeeUSD: offer.paymentFee, otherPurchaseCostsUSD: offer.otherPurchaseCost === null ? [] : [{ code: "OTHER_PURCHASE_COST", label: "Otro costo de compra", amountUSD: offer.otherPurchaseCost, subjectToFxSpread: true }], observedAt: offer.observedAt.toISOString(), ...(offer.expiresAt === null ? {} : { expiresAt: offer.expiresAt.toISOString() }), productUrl: offer.sourceUrl ?? "https://evidence.invalid/offer" }, marketData: { listings: usableListings.map((listing) => ({ id: listing.id.toString(), ...(listing.externalId === null ? {} : { externalListingId: listing.externalId }), sourceId: listing.marketplaceId.toString(), productVariantId: listing.productVariantId.toString(), condition: listing.conditionGrade.code as OpportunityEngineInput["offer"]["condition"], channel: listing.salesChannel!.code as SaleChannel, sellerGrossPriceCOP: listing.price, observedAt: listing.observedAt.toISOString(), active: true })), expectedDaysToSell: expectedDaysToSell as Partial<Record<SaleChannel, number>>, liquidityIndex: Object.fromEntries([...channels].map((value) => [value, policy.marketSignals[value].liquidityIndex])) as Partial<Record<SaleChannel, Decimal>>, priceVolatilityRate: Object.fromEntries([...channels].map((value) => [value, policy.marketSignals[value].priceVolatilityRate])) as Partial<Record<SaleChannel, Decimal>> }, shippingQuotes: eligibleQuotes.map((quote) => ({ id: quote.id.toString(), providerId: quote.shippingProviderId.toString(), offerId: offer.id.toString(), internationalShippingCOP: quote.internationalShipping, insuranceCOP: quote.insurance!, customsCOP: quote.customs!, vatCOP: quote.vat!, handlingCOP: quote.handling, nationalizationCOP: quote.nationalization!, localDeliveryCOP: quote.localDelivery!, otherCostsCOP: [], estimatedDeliveryDays: quote.estimatedDeliveryDays!, observedAt: quote.quotedAt.toISOString(), ...(quote.expiresAt === null ? {} : { expiresAt: quote.expiresAt.toISOString() }), completeness: "COMPLETE" as const })), exchangeRate: { id: exchangeRate.id.toString(), trmCopPerUsd: exchangeRate.rate, cardSpreadRate: settings.fxSpreadRate, fixedConversionFeeCOP: policy.exchange.fixedConversionFeeCop, observedAt: exchangeRate.observedAt.toISOString(), source: exchangeRate.source }, settings: { id: settings.id.toString(), version: settings.version, finance: { monthlyRate: settings.monthlyFinancingRate, dayBasis: settings.financingDaysPerMonth, debtFundingRate: settings.initialCapitalCop.isZero() ? new Decimal(0) : settings.financedPrincipalCop.dividedBy(settings.initialCapitalCop), annualizationMethod: policy.finance.annualizationMethod }, warranty: { rate: settings.warrantyReserveRate, basis: settings.warrantyReserveBasis }, marketPricing: { method, ...(method === "NEAREST_RANK_PERCENTILE" ? { percentile: settings.conservativePriceParameter! } : {}), safetyMarginRate: settings.safetyMarginRate, minComparablesForRecommendation: policy.market.minComparablesForRecommendation, maxListingAgeDays: policy.market.maxListingAgeDays }, salesChannels, velocity: policy.velocity, scoring: policy.scoring, classificationRules: policy.classificationRules, maxCapitalPerProductRate: settings.maxCapitalPerProductRate, recommendationPolicy: { rejectWhenUnaffordable: policy.recommendation.rejectWhenUnaffordable, rejectWhenConcentrationExceeded: policy.recommendation.rejectWhenConcentrationExceeded, ...(policy.recommendation.lowConfidenceSignalCap === undefined ? {} : { lowConfidenceSignalCap: policy.recommendation.lowConfidenceSignalCap }) } }, capital: { availableCapitalCOP: settings.availableCapitalCop, totalWorkingCapitalCOP: settings.initialCapitalCop, currentExposureForConcentrationKeyCOP: exposure._sum.capitalRequiredCop ?? new Decimal(0), concentrationKey: offer.productVariantId.toString() }, evaluatedAt: now } } };
}

export async function runEvaluation(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = actionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/evaluations/new?error=validation");
  const prepared = await buildContext(user.id, parsed.data.supplierOfferId);
  if (prepared.context === undefined) {
    redirect(`/evaluations/new?offerId=${parsed.data.supplierOfferId.toString()}&error=incomplete`);
    return;
  }
  const context = prepared.context;
  const analysis = analyzeOpportunity(context.input);
  if (analysis.status !== "COMPLETE" || analysis.selectedScenario === undefined || analysis.shipping?.selected === undefined) {
    redirect(`/evaluations/new?offerId=${parsed.data.supplierOfferId.toString()}&error=incomplete`);
    return;
  }
  const chosen = analysis.selectedScenario;
  const selectedShipping = analysis.shipping.selected;
  const selectedQuoteId = BigInt(selectedShipping.quote.id);
  const profileId = context.salesProfileByChannel.get(chosen.channel);
  if (profileId === undefined) {
    redirect(`/evaluations/new?offerId=${parsed.data.supplierOfferId.toString()}&error=incomplete`);
    return;
  }
  const snapshot = { input: context.input, analysis };
  await prisma.$transaction(async (tx) => {
    const previous = await tx.opportunity.findFirst({ where: { supplierOfferId: parsed.data.supplierOfferId }, orderBy: [{ analyzedAt: "desc" }, { id: "desc" }], select: { id: true } });
    await tx.opportunity.create({ data: { supplierOfferId: parsed.data.supplierOfferId, businessSettingsId: BigInt(analysis.audit.settingsId), exchangeRateId: BigInt(analysis.audit.exchangeRateId), selectedShippingQuoteId: selectedQuoteId, salesCostProfileId: profileId, analysisVersion: analysis.engineVersion, calculationPolicyVersion: context.input.settings.id, scorePolicyVersion: context.input.settings.id, analyzedAt: new Date(analysis.audit.evaluatedAt), status: "ACTIVE", ...(previous === null ? {} : { supersedesOpportunityId: previous.id }), marketSampleCount: chosen.marketPrice.statistics.count, marketMinCop: chosen.marketPrice.statistics.minimumCOP, marketAverageCop: chosen.marketPrice.statistics.averageCOP, marketMedianCop: chosen.marketPrice.statistics.medianCOP, marketMaxCop: chosen.marketPrice.statistics.maximumCOP, conservativeSalePriceCop: chosen.marketPrice.conservativeSalePriceCOP, exchangeRateApplied: context.input.exchangeRate.trmCopPerUsd, fxSpreadRateApplied: context.input.exchangeRate.cardSpreadRate, productCostCop: analysis.acquisition!.totalConvertedCOP, landedCostCop: selectedShipping.breakdown.landedCostCOP, sellingCostsCop: chosen.sellingCosts.totalEconomicCostsCOP, warrantyReserveCop: chosen.warrantyReserve.reserveCOP, financingCostCop: chosen.financing.financingCostCOP, otherCostsCop: new Decimal(0), realCostCop: chosen.profitability.realCostCOP, capitalRequiredCop: chosen.profitability.capitalRequiredCOP, grossProfitCop: chosen.profitability.grossProfitCOP, riskAdjustedProfitCop: chosen.profitability.riskAdjustedNetProfitCOP, marginRate: chosen.profitability.margin ?? new Decimal(0), roiRate: chosen.profitability.roi ?? new Decimal(0), ...(chosen.returnVelocity.monthlyizedRoi === undefined ? {} : { monthlyEquivalentRoiRate: chosen.returnVelocity.monthlyizedRoi }), ...(chosen.returnVelocity.annualizedRoi === undefined ? {} : { annualizedRoiRate: chosen.returnVelocity.annualizedRoi }), ...(context.input.marketData.expectedDaysToSell[chosen.channel] === undefined ? {} : { expectedDaysToSell: context.input.marketData.expectedDaysToSell[chosen.channel] }), ...(chosen.returnVelocity.capitalVelocityScore === undefined ? {} : { capitalVelocityScore: new Decimal(chosen.returnVelocity.capitalVelocityScore) }), opportunityScore: new Decimal(chosen.score.score), signal: chosen.classification.signal, calculationSnapshot: asJson(snapshot), scoreBreakdown: asJson(chosen.score), riskFlags: asJson(analysis.issues), comparables: { create: context.marketListings.map((listing) => ({ marketListingId: listing.id, included: true, priceAtAnalysisCop: listing.price, conditionCodeAtAnalysis: listing.conditionGrade.code })) } } });
  });
  revalidatePath("/opportunities"); revalidatePath("/evaluations/new");
  redirect("/opportunities?evaluationCreated=1");
}

export async function evaluationGaps(supplierOfferId: bigint, userId: bigint): Promise<readonly string[]> {
  return (await buildContext(userId, supplierOfferId)).errors;
}
