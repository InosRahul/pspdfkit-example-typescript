import PSPDFKit, {
    Color,
    Comment,
    HighlightAnnotation,
    Instance,
    Rect,
    SearchResult,
  } from "pspdfkit";
  
  export const sanitizeText = (text: string): string => {
    if (text) {
      text = text
        .replace(/\.{3,}/g, " ")
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\.$/, "");
    }
    return text;
  };
  
  export interface AiFinding {
    id: number;
    rfxId: number;
    docId: number;
    requirementId: number;
    organizationId: number;
    embeddingId: number;
    name: string;
    summary: string;
    rawText: string;
    cleanedText: string;
    pageNumber: number;
    coordinates: any;
    similarityScore: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    embedding: {
      id: number;
      cleanedText: string;
    };
    requirement: {
      id: number;
      name: string;
    };
  }
  
  interface CreateHighlightParams {
    instance: Instance;
    page: number;
    text: string;
    color: Color;
  }
  
  export class HighlightingUtils {
    private static createPartialHighlight = async ({
      instance,
      color,
      page,
      text,
    }: CreateHighlightParams): Promise<HighlightAnnotation | undefined> => {
      const parts = text
        .split(/[\u0000-\u001F\u007F-\u009F]|\.{4,}/)
        .filter((part) => part.trim() !== "")
        .map((part) => sanitizeText(part));
  
      const pageRects: Rect[] = [];
  
      for (const part of parts) {
        const partResults = await instance.search(part, {
          startPageIndex: page,
          endPageIndex: page,
        });
  
        if (partResults.size > 0) {
          const result = partResults.first<SearchResult>();
          const rects = result.rectsOnPage.toArray();
  
          pageRects.push(...rects);
        }
      }
  
      const combinedRects = PSPDFKit.Immutable.List(pageRects);
  
      const highlightAnnotation = new PSPDFKit.Annotations.HighlightAnnotation({
        pageIndex: page,
        rects: combinedRects,
        color,
        boundingBox: PSPDFKit.Geometry.Rect.union(combinedRects),
      });
  
      const [createdAnnotation] = await instance.create(highlightAnnotation);
  
      return createdAnnotation as HighlightAnnotation;
    };
  
    private static createHighlight = async ({
      instance,
      page,
      text,
      color,
    }: CreateHighlightParams): Promise<HighlightAnnotation | undefined> => {
      try {
        const sanitizedText = sanitizeText(text);
        const searchResults = await instance.search(sanitizedText, {
          startPageIndex: page,
          endPageIndex: page,
        });
  
        if (searchResults && searchResults.size > 0) {
          const result = searchResults.first<SearchResult>();
          const highlightAnnotation =
            new PSPDFKit.Annotations.HighlightAnnotation({
              pageIndex: page,
              rects: result.rectsOnPage,
              color,
              boundingBox: PSPDFKit.Geometry.Rect.union(result.rectsOnPage),
            });
  
          const [createdHighlightAnnotation] = await instance.create(
            highlightAnnotation
          );
          return createdHighlightAnnotation as HighlightAnnotation;
        }
  
        return this.createPartialHighlight({ instance, color, page, text });
      } catch (error) {
        console.error("Error creating highlight:", error);
      }
    };
  
    private static createComment = async ({
      instance,
      highlight,
      finding,
      color,
      customName = "Ranger",
    }: {
      instance: Instance;
      highlight: HighlightAnnotation; // represents HighlightAnnotation -> IHighlightAnnotation (which is not importable)
      finding: AiFinding;
      color: Color;
      customName?: string;
    }): Promise<Comment | undefined> => {
      const comment = new PSPDFKit.Comment({
        rootId: highlight.id,
        creatorName: customName,
        text: {
          format: "xhtml",
          value: `<b>Requirement:</b> <span style="background-color:${color.toHex()}">${
            finding.requirement.name
          }<b></span>\nAI Finding:</b> ${finding.name}\n<b>Summary:</b> ${
            finding.summary
          }`,
        },
        createdAt: new Date(),
        pageIndex: highlight.pageIndex,
        customData: { createdBy: customName },
        isEditable: false,
        isDeletable: false,
      });
  
      const [createdComment] = await instance.create(comment);
  
      return createdComment as Comment;
    };
  
    public static handleHighlightingAndComments_TEST = async (
      instance: Instance,
      findings: AiFinding[]
    ) => {
      const comments: Comment[] = [];
      const highlights: HighlightAnnotation[] = [];
  
      instance.setViewState((viewState) =>
        viewState.set("currentPageIndex", findings[0].pageNumber)
      );
  
      for (const finding of findings) {
        // Create highlight
        const highlight = await this.createHighlight({
          instance,
          page: finding.pageNumber,
          text: finding.embedding.cleanedText,
          color: Color.LIGHT_GREEN,
        });
  
        if (highlight) {
          highlights.push(highlight.toJS() as HighlightAnnotation);
          // Create comment
          const c = await this.createComment({
            instance,
            highlight,
            finding,
            color: Color.LIGHT_GREEN,
          });
          if (c) comments.push(c.toJS() as Comment);
        } else {
          console.error("Failed to create highlight for finding:", finding);
        }
      }
  
      console.log("----------------------------------------------");
      console.log("HIGHLIGHTS", highlights);
      console.log("COMMENTS", comments);
  
      // instance.getComments().then(comments => {
      //   console.log('COMMENTS', comments.toJSON());
      // });
    };
  }
  