# WCET · SAN — New Website Guide

_A plain-language guide to the refreshed site: what's new, how the pages work, how to add content, and the few things we need from you before launch._

_Last updated: 2026-09-08_

---

## What's new

Your site has been given a **complete visual refresh** built from the new Figma
design, and upgraded to the latest version of Drupal behind the scenes. The look,
the navigation, the page layouts, and the building blocks you use to create pages
are all new — but the way you log in and edit is the same as before.

Nothing you had is lost: all your existing resources, events, and pages are still
here. They now render in the new design automatically.

---

## The design at a glance

Every page is built from the same set of branded building blocks:

- **Header** — a top utility bar (Search · Policy Tracker · Contact Us · Login) and
  the main navigation with **drop-down mega-menus**.
- **Hero banner** — the blue page-intro band, in three styles: solid colour,
  half-image, or full-image.
- **Cards** — used for resources, events, quick links and "policy update" rows;
  each has a title, a rule line, some text, and a button.
- **Accordion** — expandable FAQ-style sections (click to open; the open panel turns
  blue).
- **Call-to-action banner** — the blue "Join SAN and Become a Member" style band.
- **Footer** — a light section with link columns and contact details, over a dark
  WCET band.

Brand colours: SAN blue `#1468A0`, red, and magenta accents, with Roboto/Inter type.

---

## Your pages

### Navigation
The main menu now follows the new design:

- **Home · Our Network · Learning Center · Compliance Topics · Events · Join SAN**,
  each opening a mega-menu of sub-links.
- Utility bar: **Search · Policy Tracker · Contact Us · Login**.

> ℹ️ Some menu items don't have a destination page yet, so for now they point to the
> nearest section page. See **Before launch** below.

### Resources library — `/resources/all`
A searchable, filterable grid of resource cards, with **Types** and **Topics**
filters. This is the main "browse everything" page.

### Resource / article pages
A resource can appear in **two layouts**, automatically, depending on what it
contains:

- **Article layout** — for resources with written content: a two-column page with the
  article on the left and a **"Quick links"** sidebar on the right, plus a
  **"More [topic] Resources"** row of related cards at the bottom.
  _Example to look at: the demo article "**DEMO: 15 Years of Connection…**"._
- **Downloads layout** — for resources that are just a set of links and files (most of
  your current resources): a clean, single-column **"Downloads & links"** list.

### Membership overview — `/membership`
Rebuilt to the new design: hero → a **"Quick links"** card band → **"Join SAN"**
(the step-by-step how-to-join) → a call-to-action banner → **"SAN Benefits at a
Glance"** → **"Membership Fee Structure"**.

> ⚠️ The text on this page was **typed up from the design mock-up**, so please read
> through it and correct anything — especially names, email addresses, phone numbers
> and dates.

---

## Adding content

You build pages by choosing a **content type** and then stacking **components**
(called "paragraphs") inside it.

### Content types
| Type | Use it for |
| --- | --- |
| **Resource** | Articles, white papers, coordinator calls, eNewsletters, downloadable files, external links. Tag with a Type + Topics. |
| **Event** | Events, with a date, type, topics, and an image. |
| **Landing Page** | Rich, multi-section pages (like Membership) built from a hero + components. |
| **Basic page** | Simple pages with a title and body. |
| **Resource Table** | Table-style resource listings. |

### Building a page from components
Inside Landing Pages (and the resource body), you add components such as:

- **Hero** — the page-intro banner.
- **Card row** — a titled band of cards (like "Quick links").
- **Content block** — a heading + rich text; add a link with no body and it becomes a
  **call-to-action banner**.
- **FAQ / accordion** — expandable Q&A.
- **Resources / Events summary** — auto-pulls cards for chosen topics.

### Two ready-made templates to copy
We built two demo pages you can open, view, and copy the structure of:

- **Landing page:** `/wiche-design-demo`
- **Article:** the "DEMO: 15 Years of Connection…" resource

### Images make the cards nicer
- Add an **image to a Topic** → its Resource cards become the image-overlay style.
- Add an **image to an Event** → the event card gets a picture at the top.

The image fields are already on the forms — just upload and the design updates itself.

---

## Before launch — your checklist

A short list of content decisions and finishing touches that are yours to make:

1. **Proofread the Membership page** (`/membership`) — the copy was transferred from
   the mock-up; confirm the contacts, dates, and details.
2. **Menu targets** — a handful of new menu items (e.g. *SAN Essentials, WCET Job
   Posts,* and the external-resource links) currently point at their section page.
   Tell us the correct destination for each, or set them in **Structure » Menus**.
3. **Footer links** — the footer columns use placeholder links for now; let us know the
   real destinations.
4. **Upload Topic & Event images** to switch on the image-based cards.
5. **Search** — the old search was retired; the "Search" link needs the new search page
   wired up (let us know when you'd like that built).
6. **Spam protection (CAPTCHA)** — currently switched off site-wide. Before launch,
   decide which forms (login, register, contact, join) should have it turned on.

---

## Logging in & editing

- Log in at **/user/login** (or the **Login** link, top-right).
- Edit any page using the **Edit** tab that appears at the top when you're logged in.
- Find everything under **Content** in the admin toolbar; create new items with
  **Content » Add content**.

If anything looks off or you'd like a change, just let us know.
