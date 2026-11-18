# WCET·SAN — Latest Updates & How-To (September 2026)

A quick guide to the new authoring features and the issues we've fixed. For the
full authoring handbook, see [`client-guide.md`](client-guide.md).

---

## New features — how to use them

### 1. Header/banner style (Solid · Half image · Full-width image)
When you edit a page's **Header** component, the banner has three looks:

- **Solid colour + copy** — leave the **Image** field empty. You get the
  blue→navy gradient with your eyebrow + heading.
- **Half-page image** — add an **Image**. It fills the right half beside the
  text automatically.
- **Full-width background image** — add an **Image** *and* tick the new
  **"Use full-width background image"** checkbox. The image spans the whole
  banner behind the text, with a dark shade on the left so the text stays
  readable.

> Tip: use a landscape image at least ~1600px wide for the best result.

### 2. "Blue text" style
To colour text blue (e.g. on the Membership page):

1. Select the text in the editor.
2. Open the **Styles** dropdown in the toolbar.
3. Choose **Blue text**.

The text turns brand blue and previews right in the editor. Works in both the
Full HTML and Basic HTML editors.

### 3. Spacer (add space between components)
To add vertical breathing room between components on a page:

1. When editing the page content, click **Add** and choose **Spacer**.
2. Pick a **Height** — **Small**, **Medium**, or **Large**.
3. Drag it to sit between the two components you want to separate.

Add as many as you like; each one is independent.

### 4. Topic Area cards — adding images
The image on a Topic Area / card is a **Media Library image**, not a pasted
link:

1. In the card's **Image** field, click **Add media**.
2. Upload or select an image from the Media Library, then save the page.

If an image still doesn't appear after saving, do a **cache clear** (or ask us) —
it's almost always a cached page rather than a missing image.

### 5. Logo & site name
The header now shows the **SAN logo** only — the text site name and slogan are
hidden by design. Nothing to do here; just noting the change.

---

## What we fixed

- **Header image not filling** — the banner image now fills its area properly
  instead of sitting small with gaps.
- **Header text looked broken** — extra text/links under the heading now flow
  cleanly inside the banner instead of stacking as oversized blocks.
- **Half-page banner colour** — the copy panel now uses the correct brand
  gradient (was a slightly-off flat blue).
- **Added the full-width image banner option** (see above).
- **"Compliance Topics" menu** — the External Resources links now appear as a
  proper second column on the right, matching the design.
- **Menu going off-screen** — the **Join SAN** (and Events) dropdowns no longer
  run off the right edge on laptop screens.
- **Sideways page scroll** — the page no longer scrolls horizontally / feels too
  wide on normal laptop screens (this was the same cause as the menu issue).
- **Branding** — SAN logo in place; site name + slogan hidden.
- **Added "Blue text"** style for authors.
- **Added the Spacer** component for spacing between sections.
- **Topic Area cards** now render uploaded images as full image tiles.

---

## A couple of things to note

- **Menu item names & order:** menu labels (e.g. under *Join SAN*) and their
  alphabetical order are managed in the menu settings. If you rename an item,
  the change also shows on the **Sitemap** page after a cache clear.
- **Seeing changes:** if a change doesn't show immediately, a cache clear
  usually does it. Let us know and we can clear it for you.
