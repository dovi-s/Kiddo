import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getActiveFundId } from "@/hooks/use-active-fund";
import type { Fund } from "@shared/schema";

export default function MemoryRedirect() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: funds, isLoading: fundsLoading } = useQuery<Fund[]>({
    queryKey: ["/api/funds"],
    enabled: isAuthenticated && !authLoading,
  });

  useEffect(() => {
    if (authLoading || fundsLoading) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!funds || funds.length === 0) {
      navigate("/dashboard");
      return;
    }
    const storedId = getActiveFundId();
    const target = (storedId && funds.find((f) => f.id === storedId)) ? storedId : funds[0].id;
    navigate(`/memory/${target}`, { replace: true });
  }, [authLoading, fundsLoading, isAuthenticated, funds, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
      Opening Memory Book...
    </div>
  );
}
