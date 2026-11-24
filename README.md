# Date Planner

A small, themeable web app for planning date nights and sending them as an invitation. It's built for iPhone and works on a Mac too.

- **`index.html`: the invitation.** This is the page you send. It shows a timeline of the evening, a live weather forecast with temperatures for each stop, links and maps for each place, choices she can pick between, and an outfit planner.
- **`planner.html`: the planner.** Use it to build the date:
  - time blocks that you can reorder (with the arrows or by dragging) and lengthen or shorten in 15-minute steps
  - places, with several options she can choose from or one you lock in
  - reservation tracking, with OpenTable and Resy shortcuts
  - six themes
  - a dress code, color palette and outfit ideas
  - share links
  - JSON import and export for planning with Claude

## Run locally

It's plain HTML, CSS and JavaScript modules, so there's no build step. Any static server works:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173/planner.html.

## Sharing

The planner's **Share → Make link** button packs the whole plan into the link (the part after `#`). Your girlfriend sees the plan on her own phone without a server or an account. If you change the plan, make a new link and send that one.

Her choices (which restaurant, which outfit ideas she liked, what she's wearing) are saved on her phone. The **Send picks** button lets her text them back to you.

## Planning with Claude

1. Go to Share → **Copy plan as JSON**.
2. Paste it to Claude with what you want, for example "plan a cozy December date in Brooklyn under $200".
3. Paste the JSON Claude sends back into **Paste a plan**.

## Data

Plans are saved in your browser's `localStorage`. Weather comes from [Open-Meteo](https://open-meteo.com), which needs no API key.

## Live sync (Firebase)

With Firebase set up, the planner and her page share one private "space": your edits and deletes show on her page right away, and her picks, outfit and favorites show in your planner.

1. Create a project at https://console.firebase.google.com, add a **Web app**, and create a **Realtime Database**.
2. In the database's **Rules** tab, paste `database.rules.json` and publish.
3. Put the web app's config into `js/firebase-config.js`.

The first time the planner opens with sync on, it creates a space and uploads your dates. Links you share carry the space code (`#s=…`); use **Share → Your other devices** to open the planner on another device. Without a config, the site works as before and links carry a snapshot.
