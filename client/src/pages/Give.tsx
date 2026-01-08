import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Give() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation("/moment");
  }, [setLocation]);

  return null;
}
