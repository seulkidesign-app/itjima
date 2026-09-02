declare global {
  interface Window {
    __itjimaComposerAttachmentHotfix?: boolean;
  }
}

function shouldUseDirectAttachmentPicker() {
  return (
    window.matchMedia("(max-width: 639px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function installComposerAttachmentHotfix() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__itjimaComposerAttachmentHotfix) return;
  window.__itjimaComposerAttachmentHotfix = true;

  document.addEventListener(
    "click",
    (event) => {
      if (!shouldUseDirectAttachmentPicker()) return;
      if (!(event.target instanceof Element)) return;

      const attachmentButton = event.target.closest<HTMLButtonElement>(
        'form.composer-hero button[aria-haspopup="menu"]',
      );
      if (!attachmentButton) return;

      const form = attachmentButton.closest<HTMLFormElement>("form.composer-hero");
      const fileInput = form?.querySelector<HTMLInputElement>('input[type="file"]');
      if (!fileInput) return;

      // On mobile the plus button is the direct photo/file affordance. Calling
      // click() synchronously inside the user gesture preserves iOS permission
      // behavior and avoids the attachment popover being clipped by the fixed
      // composer shell.
      event.preventDefault();
      event.stopImmediatePropagation();
      fileInput.click();
    },
    true,
  );
}

installComposerAttachmentHotfix();

export {};
