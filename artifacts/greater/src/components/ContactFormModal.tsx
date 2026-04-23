import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, AlertCircle, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

const contactSchema = z.object({
  name: z.string().min(1, "Required").max(100),
  email: z.string().email("Enter a valid email"),
  subject: z.string().max(200).optional(),
  message: z.string().min(10, "At least 10 characters").max(5000),
});

type ContactFormValues = z.infer<typeof contactSchema>;

type Status = "idle" | "submitting" | "success" | "error";

const ACCESS_KEY = (import.meta as { env: { VITE_WEB3FORMS_ACCESS_KEY?: string } }).env
  .VITE_WEB3FORMS_ACCESS_KEY;

export function ContactFormModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });

  // Reset state shortly after the modal closes so animation completes first
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStatus("idle");
        setErrorMessage(null);
        form.reset();
      }, 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, form]);

  const onSubmit = async (values: ContactFormValues) => {
    if (!ACCESS_KEY) {
      setErrorMessage(
        "The contact form is not yet configured for this deployment. Please reach out via colonhyphenbracket.pink.",
      );
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          name: values.name,
          email: values.email,
          subject: values.subject || "Greater — inbound lead",
          message: values.message,
          to: "cubby@colonhyphenbracket.pink",
          bcc: "rorshock@protonmail.com",
          from_name: "Greater contact form",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (json.success) {
        setStatus("success");
      } else {
        setErrorMessage(json.message || "Could not send your message. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Network error — please try again in a moment.");
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="py-6 text-center"
            >
              <div className="mx-auto w-10 h-10 rounded-full border border-border flex items-center justify-center mb-4">
                <Check className="w-5 h-5" style={{ color: "#FE299E" }} />
              </div>
              <DialogTitle className="text-lg font-semibold mb-2">
                Message sent
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mb-6">
                I&rsquo;ll get back to you within a business day. If it&rsquo;s urgent, mention
                that in the subject line and I&rsquo;ll prioritize.
              </DialogDescription>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full"
                data-testid="button-contact-close"
              >
                Close
              </Button>
            </motion.div>
          ) : status === "error" ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="py-6 text-center"
            >
              <div className="mx-auto w-10 h-10 rounded-full border border-border flex items-center justify-center mb-4">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <DialogTitle className="text-lg font-semibold mb-2">
                Something went wrong
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mb-6">
                {errorMessage ?? "Please try again."}
              </DialogDescription>
              <Button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setErrorMessage(null);
                }}
                className="rounded-full"
                data-testid="button-contact-retry"
              >
                Try Again
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  Interested in improving your support?
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Tell me about the bot you have in mind, your audience, and the
                  rough timeline. I read every message.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4 mt-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="chb-mono-label text-foreground">
                          Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-contact-name"
                            placeholder="Your name"
                            disabled={status === "submitting"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="chb-mono-label text-foreground">
                          Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-contact-email"
                            type="email"
                            placeholder="you@company.com"
                            disabled={status === "submitting"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="chb-mono-label text-foreground">
                          Subject (optional)
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-contact-subject"
                            placeholder="e.g. Greater for our HealthTech app"
                            disabled={status === "submitting"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="chb-mono-label text-foreground">
                          Message
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            data-testid="input-contact-message"
                            placeholder="A few sentences about what you're trying to build."
                            rows={5}
                            disabled={status === "submitting"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!ACCESS_KEY && (
                    <p className="text-xs text-muted-foreground border border-border rounded-md p-3">
                      Note: this contact form is not yet configured for this
                      deployment. Add <code className="font-mono">VITE_WEB3FORMS_ACCESS_KEY</code> to enable.
                    </p>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onOpenChange(false)}
                      className="rounded-full"
                      disabled={status === "submitting"}
                      data-testid="button-contact-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="rounded-full"
                      disabled={status === "submitting"}
                      data-testid="button-contact-submit"
                    >
                      {status === "submitting" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
