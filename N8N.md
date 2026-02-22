# n8n Lead Outreach – Email Automation

This workflow automates the Blocharch email sequence using your scraped architect data and the templates you provided.

## Flow

```
Cold Email (first contact)
   ├─ Positive Reply     → Book Call Email
   ├─ Negative Reply     → Thank You Email
   └─ No Reply           → Follow-Up Email
         ├─ Interested   → Book Call Email
         └─ Not Interested → Thank You Email
```

Routing is done by **outreach_stage** on each lead. The dashboard API maps pipeline status to stage by default:

| outreach_stage | Email sent        |
|----------------|-------------------|
| cold           | First cold email  |
| no_reply       | Follow-up         |
| positive_reply / follow_up_interested | Book call |
| negative_reply / follow_up_not_interested | Thank you |

## Import the workflow

1. In n8n: **Workflows** → **Import from File** (or **Import from URL** if you host the JSON).
2. Select `n8n-lead-outreach-workflow.json` from this folder.
3. Configure the **Send Email** nodes (all four) with your **SMTP** or **Gmail** credentials.

## Where leads come from

**Option A – From your dashboard (recommended)**  
The **Fetch leads from dashboard** node calls:

- `GET {{ DASHBOARD_URL }}/api/n8n/leads?status=cold&limit=200`

Set the env variable **DASHBOARD_URL** in n8n to your deployed app (e.g. `https://yourapp.onrender.com`). No trailing slash.

- `?status=cold` → only leads that haven’t been contacted (cold email).
- `?status=no_reply` → for follow-up runs.
- Omit `status` to get all leads (workflow will route each by its stage).

**Option B – Manual / inject**  
Replace **Fetch leads from dashboard** with an **Inject** or **Set** node that outputs one item per lead, each with at least:

- `email`
- `name` or `practice.name`
- `contact` or `practice.contact` (used for “First Name”)
- `outreach_stage`: `cold` | `positive_reply` | `negative_reply` | `no_reply` | `follow_up_interested` | `follow_up_not_interested`

## Template variables

The workflow fills these from each lead:

- **{{ firstName }}** – First word of contact name or practice name.
- **{{ companyName }}** – Practice name.
- **{{ website }}** / **{{ websiteLink }}** – Practice website, or Blocharch’s if missing.

Set **FROM_EMAIL** in n8n (e.g. `jethro@blocharch.com`) or it will use the default in the node.

## Running the workflow

1. **Cold run:** Call the API with `?status=cold` (or trigger manually with injected leads). Only leads with an email are returned.
2. **Follow-up run:** After moving leads to `no_reply` in the dashboard, call with `?status=no_reply` to send follow-ups.
3. When a lead replies, update their **stage** in the dashboard (e.g. to `positive_reply` or `negative_reply`). On the next run they’ll get the Book Call or Thank You email.

You can run the workflow on a **schedule** (e.g. daily) and filter in the HTTP node by `status` so each run only sends one type of email (e.g. cold today, follow-up tomorrow).
