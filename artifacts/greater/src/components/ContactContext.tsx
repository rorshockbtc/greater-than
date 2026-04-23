import React, { createContext, useCallback, useContext, useState } from "react";
import { ContactFormModal } from "@/components/ContactFormModal";

type ContactContextValue = {
  open: () => void;
};

const ContactContext = createContext<ContactContextValue | null>(null);

export function ContactProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  return (
    <ContactContext.Provider value={{ open }}>
      {children}
      <ContactFormModal open={isOpen} onOpenChange={setIsOpen} />
    </ContactContext.Provider>
  );
}

export function useContact(): ContactContextValue {
  const ctx = useContext(ContactContext);
  if (!ctx) {
    throw new Error("useContact must be used inside <ContactProvider>");
  }
  return ctx;
}
