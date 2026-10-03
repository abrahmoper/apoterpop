import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Mail, MessageSquare } from "lucide-react";

import { UserAvatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { getConversation, inbox, markRead, threadMessages } from "@/lib/db/conversations";
import { getI18n } from "@/lib/i18n/server";
import { photoUrl } from "@/lib/photos";
import { cn, formatDate } from "@/lib/utils";
import type { Locale } from "@/lib/types";
import { ReplyBox } from "./reply-box";

/**
 * The inbox, and when ?c=<id> is present, the open thread beside it. The
 * thread query itself enforces membership, so a guessed id shows nothing.
 *
 * On phones it behaves like a chat app: the list OR the thread, never both
 * stacked, with a back link from the thread to the list.
 */
export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { t, href, locale } = await getI18n(params);
  const { c: activeId } = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect(href(`/signin?next=${encodeURIComponent(href("/messages"))}`));

  const conversations = await inbox(user.id, locale).catch(() => []);

  const active = activeId
    ? await getConversation(activeId, user.id, locale).catch(() => null)
    : null;

  const messages = active ? await threadMessages(active.id, user.id).catch(() => []) : [];

  // Opening a thread clears the viewer's badge, after reading, not before.
  if (active && active.unread > 0) {
    await markRead(active.id, user.id);
  }

  return (
    <div className="container max-w-6xl py-6 sm:py-10">
      <h1
        className={cn(
          "font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl",
          active && "hidden md:block",
        )}
      >
        {t("chat.title")}
      </h1>

      {conversations.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Mail className="size-7" aria-hidden />
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground">{t("chat.empty")}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("chat.emptyBody")}</p>
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-5 md:mt-8 md:h-[min(72vh,760px)] md:grid-cols-[minmax(0,340px)_1fr]",
            active ? "mt-0" : "mt-6",
          )}
        >
          {/* Thread list */}
          <nav
            aria-label={t("chat.title")}
            className={cn("space-y-2 md:overflow-y-auto md:pr-1", active && "hidden md:block")}
          >
            {conversations.map((conversation) => {
              const isActive = active?.id === conversation.id;
              const unread = conversation.unread > 0;
              return (
                <Link
                  key={conversation.id}
                  href={href(`/messages?c=${conversation.id}`)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                    isActive
                      ? "border-primary/40 bg-primary-soft/60"
                      : "border-border bg-card hover:bg-muted/60",
                  )}
                >
                  <UserAvatar
                    name={conversation.otherName}
                    src={conversation.otherAvatarKey ? photoUrl(conversation.otherAvatarKey) : null}
                    className="size-11 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-sm text-foreground",
                          unread ? "font-bold" : "font-semibold",
                        )}
                      >
                        {conversation.otherName}
                      </span>
                      {conversation.last_message_at ? (
                        <span className="tnum shrink-0 text-[11px] text-muted-foreground">
                          {formatDate(conversation.last_message_at)}
                        </span>
                      ) : null}
                    </span>
                    {conversation.listingTitle ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {t("chat.about", { title: conversation.listingTitle })}
                      </span>
                    ) : null}
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-xs",
                          unread ? "font-semibold text-foreground" : "text-ink-600",
                        )}
                      >
                        {conversation.last_message ?? ""}
                      </span>
                      {unread ? (
                        <span className="tnum grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                          {conversation.unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Open thread */}
          <Card
            className={cn(
              "flex h-[calc(100dvh-var(--header-h)-7.5rem)] min-h-[420px] flex-col overflow-hidden md:h-auto md:min-h-0",
              !active && "hidden md:flex",
            )}
          >
            {active ? (
              <>
                <div className="flex items-center gap-3 border-b border-border p-3 sm:p-4">
                  <Link
                    href={href("/messages")}
                    className="grid size-10 shrink-0 place-items-center rounded-full text-ink-600 hover:bg-muted md:hidden"
                    aria-label={t("chat.backToInbox")}
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </Link>
                  <UserAvatar
                    name={active.otherName}
                    src={active.otherAvatarKey ? photoUrl(active.otherAvatarKey) : null}
                    className="size-10 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold text-foreground">
                      {active.otherName}
                    </p>
                    {active.listing_id && active.listingTitle ? (
                      <Link
                        href={href(`/listing/${active.listing_id}`)}
                        className="block truncate text-xs font-medium text-primary hover:underline"
                      >
                        {t("chat.about", { title: active.listingTitle })}
                      </Link>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("chat.startedBy", { date: formatDate(active.created_at) })}
                      </p>
                    )}
                  </div>
                </div>

                {/* column-reverse starts the scroll at the newest message with no JS */}
                <div
                  className="flex flex-1 flex-col-reverse gap-2.5 overflow-y-auto bg-muted/30 p-4"
                  aria-live="polite"
                >
                  {[...messages].reverse().map((message) => {
                    const mine = message.sender_id === user.id;
                    return (
                      <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed shadow-sm",
                            mine
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md border border-border bg-card text-ink-800",
                          )}
                        >
                          <p className="whitespace-pre-line break-words">{message.body}</p>
                          <p
                            className={cn(
                              "tnum mt-1 text-right text-[10px]",
                              mine ? "text-primary-foreground/70" : "text-muted-foreground",
                            )}
                          >
                            {formatDate(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border bg-card p-3 sm:p-4">
                  <ReplyBox conversationId={active.id} />
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-10 text-center">
                <div>
                  <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                    <MessageSquare className="size-6" aria-hidden />
                  </div>
                  <p className="text-sm text-muted-foreground">{t("chat.selectThread")}</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
