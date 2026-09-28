# ASSEMBLE — 6-Hour Vibe Coding Hackathon

**Avengers: Code Assemble** is a six-hour hackathon held as part of **MACFIESTA 2K26** at **MACFAST, Tiruvalla**, on **25 September 2026**. Teams choose a challenge domain, build a working solution during the event, and present a demo and pitch.

> This repository contains the hackathon registration and administration website. Event information and registration: [hackathon.macfast.org](https://hackathon.macfast.org/).

## Challenge domains

| Domain | Focus |
| --- | --- |
| **VISION** | AI and machine learning |
| **VITALS** | Health technology |
| **TERRA** | Climate and sustainability |
| **OPEN** | Open innovation |

## Website features

- Participant account registration and sign-in
- Team registration with leader and member details (up to three people)
- Domain selection and payment submission with transaction ID and screenshot
- Registration status tracking: pending, confirmed, or rejected
- Admin dashboard to search teams, review payment proof, and approve or reject registrations
- Excel export of registration data
- Event information pages for rules, domains, timeline, announcements, and leaderboard

## Tech stack

- **Backend:** Python, Flask, Flask-WTF
- **Data and authentication:** Supabase (PostgreSQL and Auth)
- **Frontend:** HTML, CSS, JavaScript
- **Export:** openpyxl

## Hackathon rules at a glance

- Teams may have **one to three members**. Bring a valid college ID, laptop, charger, and any extension cord you need. Report **30 minutes before** the competition starts.
- The problem statement and submission deadline are announced during the event. Build the solution during the competition; complete projects prepared in advance are prohibited.
- Libraries, APIs, and templates may be used if declared. Internet access is permitted for documentation, APIs, packages, and research. AI assistants are allowed unless the organizers announce a restriction.
- Submit your **code, README, presentation or pitch, and working demo or prototype** by the deadline.
- Plagiarism and unauthorized collaboration may lead to disqualification. Teams must be ready to present at their assigned time.

Refer to the event website and announcements for the final schedule, judging criteria, and any updates from the organizers.

## Running the website locally

The source code is not included alongside this README draft, so verify the dependency file, Flask entry point, and exact environment variable names in the repository before using these commands.

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Create a local `.env` file with the Flask secret and the Supabase URL and credentials expected by the application. Keep service role keys and admin credentials on the server; never commit `.env` or payment screenshots containing personal information.

```bash
flask --app app run --debug
```

If the application uses a different entry point or start command, replace `app` accordingly. For production, configure the same environment values in the hosting provider and use the repository's production start command.

## Project notes

Registration collects participant contact and college details as well as payment evidence. Limit access to the admin dashboard and exports, and retain this data only as needed for event administration.

**Organized by:** MACFIESTA 2K26, MACFAST (Autonomous), Tiruvalla.
