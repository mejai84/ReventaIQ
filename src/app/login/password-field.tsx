"use client";

import { useState } from "react";
import { Eye, EyeOff } from "@/components/icons";

export function PasswordField() { const [visible, setVisible] = useState(false); return <label>Contraseña<span className="password-control"><input required type={visible ? "text" : "password"} name="password" autoComplete="current-password" minLength={12} maxLength={256} /><button type="button" className="password-toggle" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></span></label>; }