"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccessError, loginAdministrator, loginErrorMessage } from "./access-client";
import { AdminLoginForm } from "./admin-login-form";

export function AdminLogin() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleLogin(email: string, password: string) {
    setPending(true);
    setErrorMessage(undefined);
    try {
      const session = await loginAdministrator(email, password);
      if (session.role !== "ADMIN") throw new AccessError(403);
      router.replace("/administracao");
      return true;
    } catch (error) {
      setErrorMessage(loginErrorMessage(error));
      return false;
    } finally {
      setPending(false);
    }
  }

  return <AdminLoginForm onSubmit={handleLogin} pending={pending} errorMessage={errorMessage} />;
}
