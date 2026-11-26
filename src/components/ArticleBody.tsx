import { renderArticleMarkdown } from "../lib/articles";

/** An article body, rendered from Markdown. The HTML always goes
 * through DOMPurify (see renderArticleMarkdown) — never raw. */
export default function ArticleBody({ bodyMarkdown }: { bodyMarkdown: string }) {
  return (
    <div
      className="article-body"
      dangerouslySetInnerHTML={{ __html: renderArticleMarkdown(bodyMarkdown) }}
    />
  );
}
