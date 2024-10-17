import PSPDFKit from "pspdfkit";
import { AiFinding, HighlightingUtils } from "./highlight-utils";
import { AI_FINDING_MOCK } from "./mock";

let instance: any = null;

async function load(document: string) {
  console.log(`Loading ${document}...`);
  try {
    instance = await PSPDFKit.load({
      document,
      container: ".container",
      baseUrl: "",
      disableWebAssemblyStreaming: true,
      anonymousComments: false,
      // isEditableComment: false,
    });

    // Call the HighlightingUtils function after the instance is loaded
    await HighlightingUtils.handleHighlightingAndComments_TEST(
      instance,
      AI_FINDING_MOCK as unknown as AiFinding[]
    );
  } catch (error) {
    console.error("Failed to load PSPDFKit instance:", error);
  }
}

interface HTMLInputEvent extends Event {
  target: HTMLInputElement & EventTarget;
}

let objectUrl = "";

document.addEventListener("change", async function (event: Event) {
  const inputEvent = event as HTMLInputEvent;
  if (
    inputEvent.target &&
    inputEvent.target.className === "chooseFile" &&
    inputEvent.target.files instanceof FileList
  ) {
    PSPDFKit.unload(".container");

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    objectUrl = URL.createObjectURL(inputEvent.target.files[0]);
    await load(objectUrl);
  }
} as EventListener);

// Initial load of the example PDF
load("example_2.pdf");