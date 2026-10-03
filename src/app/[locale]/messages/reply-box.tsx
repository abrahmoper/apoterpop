"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { sendMessageAction } from "@/actions/messages";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

/**
 * Reply box for an open thread. Clears itself on a successful send.
 * Enter sends on a physical keyboard; on touch screens Enter is a new line,
 * because phone users tap the send button.
 */
export function ReplyBox({ conversationId }: { conversationId: string }) {
  const { t } = useI18n();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const send = () => {
    const text = body.trim();
    if (!text || isPending) return;

    startTransition(async () => {
      try {
        const res = await sendMessageAction(conversationId, text);
        if (res.ok) setBody("");
        else toast.error(t(res.error));
      } catch {
        toast.error(t("error.generic"));
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex items-end gap-2"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("chat.placeholder")}
        aria-label={t("chat.placeholder")}
        rows={1}
        maxLength={2000}
        className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-card px-4 py-2.5 text-base leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
        onKeyDown={(e) => {
          const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
          if (e.key === "Enter" && !e.shiftKey && !touch && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
      />
      <Button
        type="submit"
        size="icon"
        className="shrink-0 rounded-full"
        loading={isPending}
        disabled={isPending || !body.trim()}
        aria-label={t("chat.send")}
      >
        {isPending ? null : <Send aria-hidden />}
      </Button>
    </form>
  );
}
