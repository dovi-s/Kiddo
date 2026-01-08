import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Registry() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation("/give");
  }, [setLocation]);

  return null;
}
