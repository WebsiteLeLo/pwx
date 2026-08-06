import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { verifyPendingToken } from "@/lib/access-key";

export default function VerifyPage() {
  const [status, setStatus] = useState<"checking" | "success" | "failed">("checking");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const success = verifyPendingToken();
    setStatus(success ? "success" : "failed");

    if (success) {
      const timer = setTimeout(() => setLocation("/pw"), 2000);
      return () => clearTimeout(timer);
    }
  }, [setLocation]);

  if (status === "checking") return <p>Verifying...</p>;
  if (status === "success") return <h2>Access granted for 24 hours ✅ Redirecting...</h2>;
  return (
    <div>
      <h2>Verification failed</h2>
      <button onClick={() => setLocation("/access")}>Try Again</button>
    </div>
  );
}
