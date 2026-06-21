import { useMemo, useState } from "react";
import { EMOJI_CATEGORIES, filterEmojis } from "../lib/emojiData";

export function EmojiPanel({
  query,
  onCopy,
}: {
  query: string;
  onCopy: (emoji: string) => void | Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState(EMOJI_CATEGORIES[0]!.id);

  const emojis = useMemo(
    () => filterEmojis(query, categoryId),
    [categoryId, query],
  );

  const searching = query.trim().length > 0;

  return (
    <div className="library-panel flex h-full min-h-0 flex-col">
      {!searching ? (
        <div className="library-panel-toolbar shrink-0 pb-2">
          <div className="library-category-tabs">
            {EMOJI_CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => setCategoryId(item.id)}
                className={`library-category-tab ${categoryId === item.id ? "library-category-tab--active" : ""}`}
              >
                {item.icon}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="library-grid min-h-0 flex-1 overflow-y-auto">
        {emojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            className="library-grid-item library-grid-item--emoji"
            onClick={() => void onCopy(emoji)}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
