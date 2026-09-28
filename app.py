import os
import re
from datetime import datetime, timedelta, timezone
from functools import wraps
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from dotenv import load_dotenv
from flask import (
    Flask,
    flash,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from flask_wtf.csrf import CSRFProtect
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from supabase import Client, create_client
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.utils import secure_filename


load_dotenv(Path(__file__).with_name(".env"))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
app.config["MAX_CONTENT_LENGTH"] = 3 * 1024 * 1024

PAYMENT_SCREENSHOT_LIMIT = 2 * 1024 * 1024
PAYMENT_BUCKET = "payment-screenshots"
ALLOWED_PAYMENT_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
REGISTRATION_FEE = float(os.environ.get("REGISTRATION_FEE", "200"))

COLLEGE_EVENT_CATALOG = [
    {"number": "01", "name": "Avengers: Code Assemble", "type": "Vibe Coding Hackathon", "category": "Tech", "time": "10:00 AM", "fee": 200, "prize": 15000, "tagline": "Assemble Your Ideas. Code Your Victory.", "accent": "red"},
    {"number": "02", "name": "The Flash: Code Rush", "type": "Coding Challenge", "category": "Tech", "time": "11:00 AM", "fee": 100, "prize": 5000, "tagline": "Think Fast. Code Faster.", "accent": "yellow"},
    {"number": "03", "name": "Infinity War", "type": "BGMI", "category": "Gaming", "time": "10:00 AM", "fee": 200, "prize": 7000, "tagline": "One Battleground. One Survivor.", "accent": "purple"},
    {"number": "04", "name": "Justice League: Ultimate XI", "type": "EFootball", "category": "Gaming", "time": "10:00 AM", "fee": 100, "prize": 7000, "tagline": "Assemble Your XI. Rule the Pitch.", "accent": "blue"},
    {"number": "05", "name": "Stark Industries: The Pitch", "type": "Shark Tank", "category": "Business", "time": "11:00 AM", "fee": 150, "prize": 15000, "tagline": "Pitch Bold. Think Bigger. Win Big.", "accent": "cyan"},
    {"number": "06", "name": "Spider-Verse: Frame Hunt", "type": "Photography", "category": "Creative", "time": "10:00 AM", "fee": 100, "prize": 5000, "tagline": "Capture the Moment. Own the Frame.", "accent": "red"},
    {"number": "07", "name": "Deadpool: Reel Chaos", "type": "Reels Competition", "category": "Creative", "time": "10:00 AM", "fee": 100, "prize": 5000, "tagline": "Create Chaos. Go Viral.", "accent": "red"},
    {"number": "08", "name": "Guardians of the Galaxy: Dance Off", "type": "Group Dance", "category": "Cultural", "time": "11:00 AM", "fee": 150, "prize": 5000, "tagline": "Own the Beat. Rule the Galaxy.", "accent": "purple"},
    {"number": "09", "name": "The Dark Knight: Hunt for the Signal", "type": "Treasure Hunt", "category": "Adventure", "time": "10:00 AM", "fee": 200, "prize": 15000, "tagline": "Follow the Clues. Become the Legend.", "accent": "yellow"},
    {"number": "10", "name": "Batman: Gotham Files", "type": "Cold Investigation", "category": "Adventure", "time": "10:00 AM", "fee": 150, "prize": 7000, "tagline": "Every Clue Lies. Find the Truth.", "accent": "blue"},
    {"number": "11", "name": "Doctor Strange: Multiverse Escape", "type": "Escape Room", "category": "Adventure", "time": "10:00 AM", "fee": 200, "prize": 5000, "tagline": "One Room. Infinite Realities. Escape.", "accent": "purple"},
    {"number": "12", "name": "Iron Chef: Battle of Heroes", "type": "Master Cook", "category": "Culinary", "time": "10:00 AM", "fee": 200, "prize": 10000, "tagline": "Enter Hungry. Leave Legendary.", "accent": "orange"},
    {"number": "13", "name": "LexCorp vs Stark Industries", "type": "The Ultimate Marketing Challenge", "category": "Business", "time": "10:30 AM", "fee": 150, "prize": 10000, "tagline": "Think. Persuade. Dominate.", "accent": "green"},
]

if not app.config["SECRET_KEY"]:
    raise RuntimeError("SECRET_KEY is missing from the .env file")

csrf = CSRFProtect(app)


def create_auth_client() -> Client:
    """Create a request-local Supabase client for participant authentication."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is missing from .env"
        )

    return create_client(url, key)



def create_server_client() -> Client:
    """Create a backend-only client for protected database operations."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL or SUPABASE_SECRET_KEY is missing from .env"
        )

    return create_client(url, key)


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if not session.get("user_id"):
            flash("Please log in to continue.", "error")
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped_view


def admin_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if not session.get("user_id"):
            flash("Please log in as an administrator.", "error")
            return redirect(url_for("login"))
        if session.get("user_role") != "admin":
            flash("You are not authorized to access the admin dashboard.", "error")
            return redirect(url_for("dashboard"))
        return view(*args, **kwargs)

    return wrapped_view


def get_leader_team(server_client: Client, leader_id: str):
    response = (
        server_client.table("teams")
        .select(
            "id, team_name, project_title, project_domain, "
            "registration_status, created_at"
        )
        .eq("leader_id", leader_id)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


def create_user_notification(
    server_client: Client,
    *,
    user_id: str,
    team_id: int,
    title: str,
    message: str,
    notification_type: str,
):
    """Store a private dashboard notification for one team leader."""
    return (
        server_client.table("user_notifications")
        .insert(
            {
                "user_id": user_id,
                "team_id": team_id,
                "title": title,
                "message": message,
                "notification_type": notification_type,
                "is_read": False,
            }
        )
        .execute()
    )


def get_current_user_receipt():
    """Return receipt data only for the logged-in leader of an approved team."""
    server_client = create_server_client()
    team = get_leader_team(server_client, session["user_id"])
    if not team:
        return None

    payment_response = (
        server_client.table("payments")
        .select("id, transaction_id, amount, payment_status, submitted_at, verified_at")
        .eq("team_id", team["id"])
        .eq("payment_status", "approved")
        .limit(1)
        .execute()
    )
    if not payment_response.data:
        return None

    members_response = (
        server_client.table("team_members")
        .select("member_name, email, college_name, is_team_leader")
        .eq("team_id", team["id"])
        .order("is_team_leader", desc=True)
        .execute()
    )
    members = members_response.data or []
    leader = next(
        (member for member in members if member.get("is_team_leader")),
        members[0] if members else {},
    )
    payment = payment_response.data[0]
    return {
        "team": team,
        "payment": payment,
        "members": members,
        "leader": leader,
        "receipt_number": f"ASM-2026-{int(payment['id']):05d}",
    }


def draw_pdf_image(pdf, image_path, x, y, max_width, max_height):
    """Draw an image inside a box while preserving its aspect ratio."""
    if not image_path.exists():
        return False
    try:
        image = ImageReader(str(image_path))
        width, height = image.getSize()
        scale = min(max_width / width, max_height / height)
        draw_width, draw_height = width * scale, height * scale
        pdf.drawImage(
            image,
            x + (max_width - draw_width) / 2,
            y + (max_height - draw_height) / 2,
            draw_width,
            draw_height,
            preserveAspectRatio=True,
            mask="auto",
        )
        return True
    except Exception:
        app.logger.warning("A receipt logo could not be rendered", exc_info=True)
        return False


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/macfiesta")
def macfiesta():
    return render_template("macfiesta.html")

@app.route("/events")
def college_events():
    categories = sorted({event["category"] for event in COLLEGE_EVENT_CATALOG})
    return render_template(
        "events.html",
        events=COLLEGE_EVENT_CATALOG,
        categories=categories,
        total_prize=sum(event["prize"] for event in COLLEGE_EVENT_CATALOG),
    )


@app.route("/rules")
def rules_and_regulations():
    return render_template("rules.html")


@app.route("/domains")
def domains():
    return render_template("domains.html")


@app.route("/timeline")
def timeline():
    return render_template("timeline.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user_id"):
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        remember = request.form.get("remember") == "on"

        if not email or not password:
            flash("Enter your email address and password.", "error")
            return render_template("login.html"), 400

        try:
            auth_client = create_auth_client()
            auth_response = auth_client.auth.sign_in_with_password(
                {
                    "email": email,
                    "password": password,
                }
            )

            if not auth_response.user:
                flash("Invalid email address or password.", "error")
                return render_template("login.html"), 401

            user_id = str(auth_response.user.id)
            server_client = create_server_client()
            profile_response = (
                server_client.table("profiles")
                .select("full_name, role")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )

            if not profile_response.data:
                flash("Your account profile could not be found.", "error")
                return render_template("login.html"), 403

            profile = profile_response.data[0]

            session.clear()
            session.permanent = remember
            session["user_id"] = user_id
            session["user_email"] = email
            session["full_name"] = profile.get("full_name", "Participant")
            session["user_role"] = profile.get("role", "participant")

            flash("Welcome back! You have logged in successfully.", "success")
            if session["user_role"] == "admin":
                return redirect(url_for("admin_dashboard"))
            return redirect(url_for("dashboard"))

        except Exception as exc:
            message = str(exc).lower()

            if (
                "invalid login credentials" in message
                or "invalid_credentials" in message
            ):
                flash("Invalid email address or password.", "error")
            elif "email not confirmed" in message:
                flash("Confirm your email address before logging in.", "error")
            else:
                app.logger.exception("Supabase login failed")
                flash("Login could not be completed. Please try again.", "error")

            return render_template("login.html"), 401

    return render_template("login.html")


@app.route("/dashboard")
@login_required
def dashboard():
    if session.get("user_role") == "admin":
        return redirect(url_for("admin_dashboard"))

    team = None
    payment = None
    members_count = 0
    notifications = []
    announcements = []
    unread_count = 0

    try:
        server_client = create_server_client()
        user_id = session["user_id"]

        team_response = (
            server_client.table("teams")
            .select(
                "id, team_name, project_title, project_domain, "
                "registration_status, created_at"
            )
            .eq("leader_id", user_id)
            .limit(1)
            .execute()
        )

        if team_response.data:
            team = team_response.data[0]
            team_id = team["id"]

            members_response = (
                server_client.table("team_members")
                .select("id", count="exact")
                .eq("team_id", team_id)
                .execute()
            )
            members_count = members_response.count or len(members_response.data)

            payment_response = (
                server_client.table("payments")
                .select("amount, payment_status, rejection_reason, submitted_at")
                .eq("team_id", team_id)
                .limit(1)
                .execute()
            )
            if payment_response.data:
                payment = payment_response.data[0]

        try:
            notifications_response = (
                server_client.table("user_notifications")
                .select(
                    "id, title, message, notification_type, is_read, created_at"
                )
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            notifications = notifications_response.data or []
            unread_count = sum(1 for item in notifications if not item.get("is_read"))

            announcements_response = (
                server_client.table("announcements")
                .select("id, title, message, announcement_type, published_at")
                .eq("is_active", True)
                .order("published_at", desc=True)
                .limit(6)
                .execute()
            )
            announcements = announcements_response.data or []
        except Exception:
            app.logger.exception("Notifications and announcements could not be loaded")

    except Exception:
        app.logger.exception("Dashboard data could not be loaded")
        flash("Some dashboard information could not be loaded.", "error")

    if not team:
        next_step = {
            "title": "Assemble Your Team",
            "message": "Create your team and add up to three members including you.",
            "label": "Register Team",
            "url": url_for("register_team"),
        }
    elif not payment:
        next_step = {
            "title": "Complete Your Payment",
            "message": "Pay using the event QR code and submit your payment proof.",
            "label": "Continue to Payment",
            "url": url_for("payment"),
        }
    elif payment["payment_status"] == "rejected":
        next_step = {
            "title": "Payment Needs Attention",
            "message": payment.get("rejection_reason") or "Upload a valid payment proof.",
            "label": "Upload Again",
            "url": url_for("payment"),
        }
    elif payment["payment_status"] == "pending":
        next_step = {
            "title": "Verification in Progress",
            "message": "Your payment proof is waiting for admin verification.",
            "label": "View Status",
            "url": url_for("registration_complete"),
        }
    else:
        next_step = {
            "title": "Registration Complete",
            "message": "Your squad is approved. Your verified payment receipt is ready.",
            "label": "Download Payment Receipt",
            "url": url_for("payment_receipt"),
        }

    return render_template(
        "dashboard.html",
        team=team,
        payment=payment,
        members_count=members_count,
        notifications=notifications,
        announcements=announcements,
        unread_count=unread_count,
        next_step=next_step,
    )


@app.route("/notifications/<int:notification_id>/read", methods=["POST"])
@login_required
def mark_notification_read(notification_id):
    try:
        server_client = create_server_client()
        (
            server_client.table("user_notifications")
            .update({"is_read": True})
            .eq("id", notification_id)
            .eq("user_id", session["user_id"])
            .execute()
        )
    except Exception:
        app.logger.exception("Notification could not be marked as read")
        flash("The notification could not be updated.", "error")
    return redirect(url_for("dashboard"))


@app.route("/notifications/read-all", methods=["POST"])
@login_required
def mark_all_notifications_read():
    try:
        server_client = create_server_client()
        (
            server_client.table("user_notifications")
            .update({"is_read": True})
            .eq("user_id", session["user_id"])
            .eq("is_read", False)
            .execute()
        )
    except Exception:
        app.logger.exception("Notifications could not be marked as read")
        flash("Notifications could not be updated.", "error")
    return redirect(url_for("dashboard"))


@app.route("/admin")
@admin_required
def admin_dashboard():
    server_client = create_server_client()
    search_query = request.args.get("q", "").strip().lower()
    status_filter = request.args.get("status", "all").strip().lower()

    try:
        teams = (
            server_client.table("teams")
            .select(
                "id, leader_id, team_name, project_domain, "
                "registration_status, created_at"
            )
            .order("created_at", desc=True)
            .execute()
        ).data or []

        profiles = (
            server_client.table("profiles")
            .select("id, full_name, phone, college_name")
            .execute()
        ).data or []

        members = (
            server_client.table("team_members")
            .select(
                "team_id, member_name, email, phone, college_name, "
                "course, year_of_study, is_team_leader"
            )
            .order("is_team_leader", desc=True)
            .execute()
        ).data or []

        payments = (
            server_client.table("payments")
            .select(
                "id, team_id, amount, transaction_id, screenshot_path, "
                "payment_status, rejection_reason, submitted_at, verified_at"
            )
            .order("submitted_at", desc=True)
            .execute()
        ).data or []

        announcements = (
            server_client.table("announcements")
            .select(
                "id, title, message, announcement_type, is_active, published_at"
            )
            .order("published_at", desc=True)
            .limit(8)
            .execute()
        ).data or []

        profile_map = {profile["id"]: profile for profile in profiles}
        payment_map = {payment["team_id"]: payment for payment in payments}
        members_map = {}
        for member in members:
            members_map.setdefault(member["team_id"], []).append(member)

        records = []
        for team in teams:
            record = {
                "team": team,
                "leader": profile_map.get(team["leader_id"], {}),
                "members": members_map.get(team["id"], []),
                "payment": payment_map.get(team["id"]),
            }

            searchable = " ".join(
                [
                    team.get("team_name", ""),
                    team.get("project_domain", ""),
                    record["leader"].get("full_name", ""),
                    record["leader"].get("college_name", ""),
                    record["payment"].get("transaction_id", "")
                    if record["payment"]
                    else "",
                ]
            ).lower()

            payment_status = (
                record["payment"].get("payment_status", "not_submitted")
                if record["payment"]
                else "not_submitted"
            )

            if search_query and search_query not in searchable:
                continue
            if status_filter != "all" and payment_status != status_filter:
                continue

            records.append(record)

        all_payment_statuses = [
            payment.get("payment_status", "not_submitted") for payment in payments
        ]
        statistics = {
            "total_teams": len(teams),
            "pending": all_payment_statuses.count("pending"),
            "approved": all_payment_statuses.count("approved"),
            "rejected": all_payment_statuses.count("rejected"),
            "not_submitted": max(len(teams) - len(payments), 0),
            "collected": sum(
                float(payment.get("amount") or 0)
                for payment in payments
                if payment.get("payment_status") == "approved"
            ),
        }

    except Exception:
        app.logger.exception("Admin dashboard data could not be loaded")
        flash("Admin data could not be loaded. Please try again.", "error")
        records = []
        announcements = []
        statistics = {
            "total_teams": 0,
            "pending": 0,
            "approved": 0,
            "rejected": 0,
            "not_submitted": 0,
            "collected": 0,
        }

    return render_template(
        "admin_dashboard.html",
        records=records,
        statistics=statistics,
        announcements=announcements,
        search_query=request.args.get("q", ""),
        status_filter=status_filter,
    )


@app.route("/admin/announcements", methods=["POST"])
@admin_required
def create_announcement():
    title = request.form.get("title", "").strip()
    message = request.form.get("message", "").strip()
    announcement_type = request.form.get("announcement_type", "general").strip()
    allowed_types = {"general", "important", "schedule", "challenge"}

    if len(title) < 3 or len(message) < 5:
        flash("Enter an announcement title and a clear message.", "error")
        return redirect(url_for("admin_dashboard"))
    if announcement_type not in allowed_types:
        announcement_type = "general"

    try:
        server_client = create_server_client()
        (
            server_client.table("announcements")
            .insert(
                {
                    "title": title,
                    "message": message,
                    "announcement_type": announcement_type,
                    "is_active": True,
                    "created_by": session["user_id"],
                }
            )
            .execute()
        )
        flash("Announcement published to participant dashboards.", "success")
    except Exception:
        app.logger.exception("Announcement could not be created")
        flash("Announcement could not be published.", "error")
    return redirect(url_for("admin_dashboard"))


@app.route("/admin/announcements/<int:announcement_id>/toggle", methods=["POST"])
@admin_required
def toggle_announcement(announcement_id):
    server_client = create_server_client()
    try:
        response = (
            server_client.table("announcements")
            .select("is_active")
            .eq("id", announcement_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            flash("Announcement could not be found.", "error")
            return redirect(url_for("admin_dashboard"))
        new_state = not bool(response.data[0].get("is_active"))
        (
            server_client.table("announcements")
            .update({"is_active": new_state})
            .eq("id", announcement_id)
            .execute()
        )
        flash("Announcement visibility updated.", "success")
    except Exception:
        app.logger.exception("Announcement visibility could not be updated")
        flash("Announcement could not be updated.", "error")
    return redirect(url_for("admin_dashboard"))


@app.route("/admin/export/users.xlsx")
@admin_required
def admin_export_users():
    """Export team and participant information as a formatted Excel workbook."""
    server_client = create_server_client()
    search_query = request.args.get("q", "").strip().lower()
    status_filter = request.args.get("status", "all").strip().lower()

    try:
        teams = (
            server_client.table("teams")
            .select(
                "id, leader_id, team_name, project_domain, "
                "registration_status, created_at"
            )
            .order("created_at", desc=True)
            .execute()
        ).data or []
        profiles = (
            server_client.table("profiles")
            .select("id, full_name, phone, college_name")
            .execute()
        ).data or []
        members = (
            server_client.table("team_members")
            .select(
                "team_id, member_name, email, phone, college_name, "
                "course, year_of_study, is_team_leader"
            )
            .order("is_team_leader", desc=True)
            .execute()
        ).data or []
        payments = (
            server_client.table("payments")
            .select(
                "team_id, amount, transaction_id, payment_status, submitted_at"
            )
            .order("submitted_at", desc=True)
            .execute()
        ).data or []
    except Exception:
        app.logger.exception("Admin Excel export data could not be loaded")
        flash("The Excel export could not be generated. Please try again.", "error")
        return redirect(url_for("admin_dashboard"))

    profile_map = {profile["id"]: profile for profile in profiles}
    payment_map = {payment["team_id"]: payment for payment in payments}
    members_map = {}
    for member in members:
        members_map.setdefault(member["team_id"], []).append(member)

    def as_excel_datetime(value):
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(
                tzinfo=None
            )
        except (TypeError, ValueError):
            return None

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Participant Details"
    headers = [
        "Team ID",
        "Team Name",
        "Domain",
        "Registration Status",
        "Member Role",
        "Member Name",
        "Email",
        "Phone",
        "College Name",
        "Course",
        "Year of Study",
        "Payment Status",
        "Transaction ID",
        "Amount (INR)",
        "Payment Submitted At",
        "Team Registered At",
    ]
    sheet.append(headers)

    exported_rows = 0
    for team in teams:
        team_members = members_map.get(team["id"], [])
        payment = payment_map.get(team["id"], {})
        leader = profile_map.get(team["leader_id"], {})
        payment_status = payment.get("payment_status", "not_submitted")
        searchable = " ".join(
            [
                team.get("team_name", ""),
                team.get("project_domain", ""),
                leader.get("full_name", ""),
                leader.get("college_name", ""),
                payment.get("transaction_id", ""),
                " ".join(member.get("member_name", "") for member in team_members),
                " ".join(member.get("email", "") for member in team_members),
                " ".join(member.get("college_name", "") for member in team_members),
            ]
        ).lower()

        if search_query and search_query not in searchable:
            continue
        if status_filter != "all" and payment_status != status_filter:
            continue

        if not team_members:
            team_members = [
                {
                    "member_name": leader.get("full_name", "Unknown"),
                    "email": "",
                    "phone": leader.get("phone", ""),
                    "college_name": leader.get("college_name", ""),
                    "course": "",
                    "year_of_study": "",
                    "is_team_leader": True,
                }
            ]

        for member in team_members:
            sheet.append(
                [
                    f"ASM-{int(team['id']):04d}",
                    team.get("team_name", ""),
                    team.get("project_domain", ""),
                    team.get("registration_status", ""),
                    "Team Leader" if member.get("is_team_leader") else "Member",
                    member.get("member_name", ""),
                    member.get("email", ""),
                    member.get("phone", ""),
                    member.get("college_name", "") or leader.get("college_name", ""),
                    member.get("course", ""),
                    member.get("year_of_study", ""),
                    payment_status.replace("_", " ").title(),
                    payment.get("transaction_id", ""),
                    float(payment.get("amount") or 0),
                    as_excel_datetime(payment.get("submitted_at")),
                    as_excel_datetime(team.get("created_at")),
                ]
            )
            exported_rows += 1

    header_fill = PatternFill("solid", fgColor="FF3048")
    for cell in sheet[1]:
        cell.fill = header_fill
        cell.font = Font(color="FFFFFF", bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center")

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    sheet.row_dimensions[1].height = 28
    widths = [13, 22, 24, 20, 16, 23, 30, 16, 38, 18, 15, 18, 22, 15, 22, 22]
    for column_number, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(column_number)].width = width

    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)
        row[13].number_format = '₹#,##0.00'
        row[14].number_format = "yyyy-mm-dd hh:mm"
        row[15].number_format = "yyyy-mm-dd hh:mm"

    if exported_rows == 0:
        sheet.append(["No participant records matched the selected filters."])
        sheet.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(headers))
        sheet["A2"].alignment = Alignment(horizontal="center")

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    filename = f"assemble-participants-{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    return send_file(
        output,
        as_attachment=True,
        download_name=filename,
        mimetype=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
    )


@app.route("/admin/export/registration-team.xlsx")
@admin_required
def admin_export_registration_team():
    """Export a simplified participant list for the registration desk."""
    server_client = create_server_client()
    search_query = request.args.get("q", "").strip().lower()
    status_filter = request.args.get("status", "all").strip().lower()

    try:
        teams = (
            server_client.table("teams")
            .select("id, leader_id, team_name, project_domain, created_at")
            .order("created_at", desc=True)
            .execute()
        ).data or []
        profiles = (
            server_client.table("profiles")
            .select("id, full_name, phone, college_name")
            .execute()
        ).data or []
        members = (
            server_client.table("team_members")
            .select(
                "team_id, member_name, email, phone, college_name, is_team_leader"
            )
            .order("is_team_leader", desc=True)
            .execute()
        ).data or []
        payments = (
            server_client.table("payments")
            .select("team_id, transaction_id, payment_status")
            .execute()
        ).data or []
    except Exception:
        app.logger.exception("Registration-team Excel export could not be loaded")
        flash("The registration Excel export could not be generated.", "error")
        return redirect(url_for("admin_dashboard"))

    profile_map = {profile["id"]: profile for profile in profiles}
    payment_map = {payment["team_id"]: payment for payment in payments}
    members_map = {}
    for member in members:
        members_map.setdefault(member["team_id"], []).append(member)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Registration Verification"
    sheet.append(["Name", "Team Name", "Email", "College Name"])

    exported_rows = 0
    for team in teams:
        team_members = members_map.get(team["id"], [])
        leader = profile_map.get(team["leader_id"], {})
        payment = payment_map.get(team["id"], {})
        payment_status = payment.get("payment_status", "not_submitted")
        searchable = " ".join(
            [
                team.get("team_name", ""),
                team.get("project_domain", ""),
                leader.get("full_name", ""),
                leader.get("college_name", ""),
                payment.get("transaction_id", ""),
                " ".join(member.get("member_name", "") for member in team_members),
                " ".join(member.get("email", "") for member in team_members),
                " ".join(member.get("college_name", "") for member in team_members),
            ]
        ).lower()

        if search_query and search_query not in searchable:
            continue
        if status_filter != "all" and payment_status != status_filter:
            continue

        if not team_members:
            team_members = [
                {
                    "member_name": leader.get("full_name", "Unknown"),
                    "email": "",
                    "college_name": leader.get("college_name", ""),
                }
            ]

        for member in team_members:
            sheet.append(
                [
                    member.get("member_name", ""),
                    team.get("team_name", ""),
                    member.get("email", ""),
                    member.get("college_name", "") or leader.get("college_name", ""),
                ]
            )
            exported_rows += 1

    header_fill = PatternFill("solid", fgColor="FF3048")
    for cell in sheet[1]:
        cell.fill = header_fill
        cell.font = Font(color="FFFFFF", bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center")

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    sheet.row_dimensions[1].height = 28
    for column, width in zip(("A", "B", "C", "D"), (26, 24, 34, 42)):
        sheet.column_dimensions[column].width = width
    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)

    if exported_rows == 0:
        sheet.append(["No participant records matched the selected filters."])
        sheet.merge_cells("A2:D2")
        sheet["A2"].alignment = Alignment(horizontal="center")

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    filename = f"registration-team-list-{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    return send_file(
        output,
        as_attachment=True,
        download_name=filename,
        mimetype=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
    )


@app.route("/admin/payment/<int:payment_id>/proof")
@admin_required
def admin_payment_proof(payment_id):
    server_client = create_server_client()
    payment_response = (
        server_client.table("payments")
        .select("screenshot_path")
        .eq("id", payment_id)
        .limit(1)
        .execute()
    )

    if not payment_response.data:
        flash("Payment proof could not be found.", "error")
        return redirect(url_for("admin_dashboard"))

    try:
        signed_response = server_client.storage.from_(PAYMENT_BUCKET).create_signed_url(
            payment_response.data[0]["screenshot_path"],
            300,
        )
        signed_url = None
        if isinstance(signed_response, dict):
            signed_url = (
                signed_response.get("signedURL")
                or signed_response.get("signedUrl")
                or signed_response.get("signed_url")
            )

        if not signed_url:
            raise RuntimeError("Supabase did not return a signed URL")

        return redirect(signed_url)

    except Exception:
        app.logger.exception("Payment proof signed URL failed")
        flash("Payment screenshot could not be opened.", "error")
        return redirect(url_for("admin_dashboard"))


@app.route("/admin/payment/<int:payment_id>/approve", methods=["POST"])
@admin_required
def approve_payment(payment_id):
    server_client = create_server_client()
    payment_response = (
        server_client.table("payments")
        .select("id, team_id, payment_status")
        .eq("id", payment_id)
        .limit(1)
        .execute()
    )

    if not payment_response.data:
        flash("Payment record could not be found.", "error")
        return redirect(url_for("admin_dashboard"))

    payment_record = payment_response.data[0]
    team_response = (
        server_client.table("teams")
        .select("id, leader_id, team_name")
        .eq("id", payment_record["team_id"])
        .limit(1)
        .execute()
    )
    if not team_response.data:
        flash("The team connected to this payment could not be found.", "error")
        return redirect(url_for("admin_dashboard"))
    team_record = team_response.data[0]
    reviewed_at = datetime.now(timezone.utc).isoformat()

    try:
        (
            server_client.table("payments")
            .update(
                {
                    "payment_status": "approved",
                    "rejection_reason": None,
                    "verified_at": reviewed_at,
                    "verified_by": session["user_id"],
                }
            )
            .eq("id", payment_id)
            .execute()
        )
        (
            server_client.table("teams")
            .update({"registration_status": "approved"})
            .eq("id", payment_record["team_id"])
            .execute()
        )
        try:
            create_user_notification(
                server_client,
                user_id=team_record["leader_id"],
                team_id=team_record["id"],
                title="Payment Approved",
                message=(
                    f"Congratulations! Payment for {team_record['team_name']} was "
                    "verified and your hackathon registration is confirmed."
                ),
                notification_type="approved",
            )
            flash(
                "Payment approved and the team leader was notified.", "success"
            )
        except Exception:
            app.logger.exception("Approval notification could not be created")
            flash(
                "Payment approved, but the in-app notification could not be created.",
                "error",
            )

    except Exception:
        app.logger.exception("Payment approval failed")
        try:
            (
                server_client.table("payments")
                .update(
                    {
                        "payment_status": payment_record["payment_status"],
                        "verified_at": None,
                        "verified_by": None,
                    }
                )
                .eq("id", payment_id)
                .execute()
            )
        except Exception:
            app.logger.exception("Payment approval rollback failed")
        flash("Payment approval could not be completed.", "error")

    return redirect(url_for("admin_dashboard"))


@app.route("/admin/payment/<int:payment_id>/reject", methods=["POST"])
@admin_required
def reject_payment(payment_id):
    reason = request.form.get("rejection_reason", "").strip()
    if len(reason) < 5:
        flash("Enter a clear reason before rejecting the payment.", "error")
        return redirect(url_for("admin_dashboard"))

    server_client = create_server_client()
    payment_response = (
        server_client.table("payments")
        .select("id, team_id, payment_status")
        .eq("id", payment_id)
        .limit(1)
        .execute()
    )

    if not payment_response.data:
        flash("Payment record could not be found.", "error")
        return redirect(url_for("admin_dashboard"))

    payment_record = payment_response.data[0]
    team_response = (
        server_client.table("teams")
        .select("id, leader_id, team_name")
        .eq("id", payment_record["team_id"])
        .limit(1)
        .execute()
    )
    if not team_response.data:
        flash("The team connected to this payment could not be found.", "error")
        return redirect(url_for("admin_dashboard"))
    team_record = team_response.data[0]
    reviewed_at = datetime.now(timezone.utc).isoformat()

    try:
        (
            server_client.table("payments")
            .update(
                {
                    "payment_status": "rejected",
                    "rejection_reason": reason,
                    "verified_at": reviewed_at,
                    "verified_by": session["user_id"],
                }
            )
            .eq("id", payment_id)
            .execute()
        )
        (
            server_client.table("teams")
            .update({"registration_status": "rejected"})
            .eq("id", payment_record["team_id"])
            .execute()
        )
        try:
            create_user_notification(
                server_client,
                user_id=team_record["leader_id"],
                team_id=team_record["id"],
                title="Payment Needs Attention",
                message=(
                    f"Payment for {team_record['team_name']} was rejected. "
                    f"Reason: {reason} Please upload a corrected payment proof."
                ),
                notification_type="rejected",
            )
            flash("Payment rejected and the team leader was notified.", "success")
        except Exception:
            app.logger.exception("Rejection notification could not be created")
            flash(
                "Payment rejected, but the in-app notification could not be created.",
                "error",
            )

    except Exception:
        app.logger.exception("Payment rejection failed")
        flash("Payment rejection could not be completed.", "error")

    return redirect(url_for("admin_dashboard"))


@app.route("/register-team", methods=["GET", "POST"])
@login_required
def register_team():
    server_client = create_server_client()
    user_id = session["user_id"]
    existing_team = get_leader_team(server_client, user_id)

    if existing_team:
        flash("Your team has already been created.", "success")
        return redirect(url_for("payment"))

    profile_response = (
        server_client.table("profiles")
        .select("full_name, phone, college_name")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    if not profile_response.data:
        flash("Your leader profile could not be found.", "error")
        return redirect(url_for("dashboard"))

    leader = profile_response.data[0]

    if request.method == "POST":
        team_name = request.form.get("team_name", "").strip()
        project_domain = request.form.get("project_domain", "").strip()

        try:
            total_members = int(request.form.get("total_members", "1"))
        except ValueError:
            total_members = 0

        allowed_domains = {
            "AI & Machine Learning",
            "HealthTech",
            "Climate & Sustainability",
            "Open Innovation",
        }
        errors = []

        if not 2 <= len(team_name) <= 100:
            errors.append("Team name must contain between 2 and 100 characters.")
        if project_domain not in allowed_domains:
            errors.append("Select a valid project domain.")
        if total_members not in {1, 2, 3}:
            errors.append("A team can contain a maximum of three members.")

        additional_members = []
        used_emails = {session["user_email"].lower()}

        for member_number in range(2, total_members + 1):
            name = request.form.get(f"member_{member_number}_name", "").strip()
            email = request.form.get(f"member_{member_number}_email", "").strip().lower()
            phone = re.sub(
                r"\D", "", request.form.get(f"member_{member_number}_phone", "")
            )
            college = request.form.get(
                f"member_{member_number}_college", ""
            ).strip()
            course = request.form.get(f"member_{member_number}_course", "").strip()
            year = request.form.get(f"member_{member_number}_year", "").strip()

            if len(name) < 2:
                errors.append(f"Enter the full name of Member {member_number}.")
            if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
                errors.append(f"Enter a valid email for Member {member_number}.")
            elif email in used_emails:
                errors.append("Every team member must use a different email address.")
            else:
                used_emails.add(email)
            if not re.fullmatch(r"[6-9]\d{9}", phone):
                errors.append(
                    f"Enter a valid 10-digit Indian number for Member {member_number}."
                )
            if len(college) < 2:
                errors.append(f"Enter the college of Member {member_number}.")
            if len(course) < 2:
                errors.append(f"Enter the course of Member {member_number}.")
            if not year:
                errors.append(f"Select the year of study for Member {member_number}.")

            additional_members.append(
                {
                    "member_name": name,
                    "email": email,
                    "phone": phone,
                    "college_name": college,
                    "course": course,
                    "year_of_study": year,
                    "is_team_leader": False,
                }
            )

        if errors:
            for error in errors:
                flash(error, "error")
            return render_template("team_register.html", leader=leader), 400

        team_id = None
        try:
            team_response = (
                server_client.table("teams")
                .insert(
                    {
                        "leader_id": user_id,
                        "team_name": team_name,
                        "project_title": None,
                        "project_domain": project_domain,
                        "registration_status": "pending",
                    }
                )
                .execute()
            )
            team_id = team_response.data[0]["id"]

            member_rows = [
                {
                    "team_id": team_id,
                    "member_name": leader["full_name"],
                    "email": session["user_email"],
                    "phone": leader.get("phone"),
                    "college_name": leader.get("college_name"),
                    "course": None,
                    "year_of_study": None,
                    "is_team_leader": True,
                }
            ]
            member_rows.extend(
                {**member, "team_id": team_id} for member in additional_members
            )
            server_client.table("team_members").insert(member_rows).execute()

            flash("Team details saved. Complete the payment to submit your team.", "success")
            return redirect(url_for("payment"))

        except Exception as exc:
            if team_id is not None:
                server_client.table("teams").delete().eq("id", team_id).execute()

            message = str(exc).lower()
            if "duplicate" in message or "unique" in message:
                flash("That team name is already registered. Choose another name.", "error")
            else:
                app.logger.exception("Team registration failed")
                flash("Team registration could not be completed. Please try again.", "error")

            return render_template("team_register.html", leader=leader), 400

    return render_template("team_register.html", leader=leader)


@app.route("/payment", methods=["GET", "POST"])
@login_required
def payment():
    server_client = create_server_client()
    team = get_leader_team(server_client, session["user_id"])

    if not team:
        flash("Register your team before making the payment.", "error")
        return redirect(url_for("register_team"))

    payment_response = (
        server_client.table("payments")
        .select(
            "id, transaction_id, screenshot_path, payment_status, "
            "rejection_reason, submitted_at"
        )
        .eq("team_id", team["id"])
        .limit(1)
        .execute()
    )
    existing_payment = payment_response.data[0] if payment_response.data else None

    if existing_payment and existing_payment["payment_status"] in {"pending", "approved"}:
        return redirect(url_for("registration_complete"))

    if request.method == "POST":
        transaction_id = request.form.get("transaction_id", "").strip().upper()
        screenshot = request.files.get("payment_screenshot")
        errors = []

        if not re.fullmatch(r"[A-Z0-9-]{6,50}", transaction_id):
            errors.append("Enter a valid UPI/UTR transaction ID.")

        if not screenshot or not screenshot.filename:
            errors.append("Upload your payment screenshot.")
            screenshot_data = b""
            extension = ""
        else:
            safe_name = secure_filename(screenshot.filename)
            extension = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
            screenshot_data = screenshot.read(PAYMENT_SCREENSHOT_LIMIT + 1)

            if extension not in ALLOWED_PAYMENT_EXTENSIONS:
                errors.append("Screenshot must be PNG, JPG, JPEG or WebP.")
            if len(screenshot_data) > PAYMENT_SCREENSHOT_LIMIT:
                errors.append("Payment screenshot must be 2 MB or smaller.")
            if not screenshot_data:
                errors.append("The uploaded screenshot is empty.")

        if errors:
            for error in errors:
                flash(error, "error")
            return render_template(
                "payment.html",
                team=team,
                existing_payment=existing_payment,
                registration_fee=REGISTRATION_FEE,
            ), 400

        storage_path = f"payments/{team['id']}/{uuid4().hex}.{extension}"

        try:
            server_client.storage.from_(PAYMENT_BUCKET).upload(
                path=storage_path,
                file=screenshot_data,
                file_options={
                    "content-type": screenshot.mimetype,
                    "cache-control": "3600",
                    "upsert": "false",
                },
            )

            payment_data = {
                "team_id": team["id"],
                "amount": REGISTRATION_FEE,
                "transaction_id": transaction_id,
                "screenshot_path": storage_path,
                "payment_status": "pending",
                "rejection_reason": None,
                "verified_at": None,
                "verified_by": None,
            }

            if existing_payment:
                (
                    server_client.table("payments")
                    .update(payment_data)
                    .eq("id", existing_payment["id"])
                    .execute()
                )
                old_path = existing_payment.get("screenshot_path")
                if old_path and old_path != storage_path:
                    try:
                        server_client.storage.from_(PAYMENT_BUCKET).remove([old_path])
                    except Exception:
                        app.logger.warning("Old rejected payment proof was not removed")
            else:
                server_client.table("payments").insert(payment_data).execute()

            flash("Your team registration was submitted successfully.", "success")
            return redirect(url_for("registration_complete"))

        except Exception as exc:
            try:
                server_client.storage.from_(PAYMENT_BUCKET).remove([storage_path])
            except Exception:
                pass

            message = str(exc).lower()
            if "transaction_id" in message or "duplicate" in message:
                flash("This transaction ID has already been submitted.", "error")
            else:
                app.logger.exception("Payment submission failed")
                flash("Payment proof could not be submitted. Please try again.", "error")

            return render_template(
                "payment.html",
                team=team,
                existing_payment=existing_payment,
                registration_fee=REGISTRATION_FEE,
            ), 400

    return render_template(
        "payment.html",
        team=team,
        existing_payment=existing_payment,
        registration_fee=REGISTRATION_FEE,
    )


@app.route("/registration-complete")
@login_required
def registration_complete():
    server_client = create_server_client()
    team = get_leader_team(server_client, session["user_id"])

    if not team:
        return redirect(url_for("register_team"))

    payment_response = (
        server_client.table("payments")
        .select("transaction_id, amount, payment_status, rejection_reason, submitted_at")
        .eq("team_id", team["id"])
        .limit(1)
        .execute()
    )
    submitted_payment = payment_response.data[0] if payment_response.data else None

    if not submitted_payment:
        return redirect(url_for("payment"))

    members_response = (
        server_client.table("team_members")
        .select("member_name, email, is_team_leader")
        .eq("team_id", team["id"])
        .order("is_team_leader", desc=True)
        .execute()
    )

    return render_template(
        "registration_complete.html",
        team=team,
        payment=submitted_payment,
        members=members_response.data or [],
    )


@app.route("/payment-receipt")
@login_required
def payment_receipt():
    receipt = get_current_user_receipt()
    if not receipt:
        flash("Your payment receipt becomes available after admin approval.", "error")
        return redirect(url_for("registration_complete"))
    return render_template("payment_receipt.html", **receipt)


@app.route("/payment-receipt/download")
@login_required
def download_payment_receipt():
    receipt = get_current_user_receipt()
    if not receipt:
        flash("Your payment receipt becomes available after admin approval.", "error")
        return redirect(url_for("registration_complete"))

    team, payment = receipt["team"], receipt["payment"]
    leader, members = receipt["leader"], receipt["members"]
    receipt_number = receipt["receipt_number"]
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    page_width, page_height = A4
    navy, gold = HexColor("#111827"), HexColor("#C99020")
    muted, pale_gold, border = HexColor("#667085"), HexColor("#FFF8E7"), HexColor("#D6D9DF")

    pdf.setTitle(f"Payment Receipt - {receipt_number}")
    pdf.setAuthor("MACFIESTA 2K26 - ASSEMBLE")
    pdf.setFillColor(navy)
    pdf.rect(0, page_height - 136, page_width, 136, fill=1, stroke=0)
    pdf.setFillColor(gold)
    pdf.rect(0, page_height - 142, page_width, 6, fill=1, stroke=0)

    image_folder = Path(app.static_folder) / "images"
    if not draw_pdf_image(pdf, image_folder / "macfast-logo.png", 38, page_height - 122, 115, 82):
        pdf.setFillColor(HexColor("#FFFFFF")); pdf.setFont("Helvetica-Bold", 17)
        pdf.drawString(42, page_height - 76, "MACFAST")
    if not draw_pdf_image(pdf, image_folder / "macfiesta-logo.png", page_width - 128, page_height - 124, 88, 88):
        pdf.setFillColor(gold); pdf.setFont("Helvetica-Bold", 13)
        pdf.drawRightString(page_width - 42, page_height - 76, "MACFIESTA 2K26")

    pdf.setFillColor(HexColor("#FFFFFF")); pdf.setFont("Helvetica-Bold", 13)
    pdf.drawCentredString(page_width / 2, page_height - 49, "MAR ATHANASIOS COLLEGE FOR ADVANCED STUDIES")
    pdf.setFont("Helvetica", 9); pdf.drawCentredString(page_width / 2, page_height - 66, "Tiruvalla, Kerala")
    pdf.setFillColor(gold); pdf.setFont("Helvetica-Bold", 16)
    pdf.drawCentredString(page_width / 2, page_height - 96, "MACFIESTA 2K26")
    pdf.setFillColor(HexColor("#FFFFFF")); pdf.setFont("Helvetica", 10)
    pdf.drawCentredString(page_width / 2, page_height - 113, "ASSEMBLE - Vibe Coding Hackathon")

    pdf.setFillColor(navy); pdf.setFont("Helvetica-Bold", 23)
    pdf.drawString(42, page_height - 190, "PAYMENT RECEIPT")
    pdf.setFillColor(muted); pdf.setFont("Helvetica", 9)
    pdf.drawString(42, page_height - 207, "Electronically generated after payment verification")
    pdf.setFillColor(pale_gold); pdf.roundRect(page_width - 218, page_height - 222, 176, 54, 7, fill=1, stroke=0)
    pdf.setFillColor(muted); pdf.setFont("Helvetica", 8)
    pdf.drawString(page_width - 205, page_height - 185, "RECEIPT NUMBER")
    pdf.setFillColor(navy); pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(page_width - 205, page_height - 204, receipt_number)

    rows = [
        ("Team ID", f"#ASM-{int(team['id']):04d}", "Team Name", team["team_name"]),
        ("Team Leader", leader.get("member_name", session.get("full_name", "")), "Domain", team["project_domain"]),
        ("Leader Email", leader.get("email", session.get("user_email", "")), "Team Size", str(len(members))),
        ("College", leader.get("college_name") or "-", "Payment Status", "APPROVED"),
    ]
    table_x, table_top, row_height, table_width = 42, page_height - 259, 49, page_width - 84
    pdf.setStrokeColor(border); pdf.setLineWidth(0.7)
    for index, row in enumerate(rows):
        y = table_top - ((index + 1) * row_height)
        pdf.setFillColor(HexColor("#FFFFFF") if index % 2 == 0 else HexColor("#F9FAFB"))
        pdf.rect(table_x, y, table_width, row_height, fill=1, stroke=1)
        pdf.setFillColor(muted); pdf.setFont("Helvetica", 7.5)
        pdf.drawString(table_x + 12, y + 31, row[0].upper())
        pdf.drawString(table_x + table_width / 2 + 12, y + 31, row[2].upper())
        pdf.setFillColor(navy); pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(table_x + 12, y + 14, str(row[1])[:43])
        pdf.drawString(table_x + table_width / 2 + 12, y + 14, str(row[3])[:36])

    payment_y = table_top - (len(rows) * row_height) - 93
    pdf.setFillColor(navy); pdf.roundRect(42, payment_y, table_width, 73, 8, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#FFFFFF")); pdf.setFont("Helvetica", 8)
    pdf.drawString(57, payment_y + 49, "TRANSACTION ID")
    pdf.setFont("Helvetica-Bold", 12); pdf.drawString(57, payment_y + 27, payment["transaction_id"])
    pdf.setFillColor(gold); pdf.setFont("Helvetica", 8)
    pdf.drawRightString(page_width - 57, payment_y + 49, "AMOUNT RECEIVED")
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawRightString(page_width - 57, payment_y + 23, f"INR {float(payment['amount']):.2f}")

    date_value = payment.get("verified_at") or payment.get("submitted_at") or ""
    pdf.setFillColor(muted); pdf.setFont("Helvetica", 8)
    pdf.drawString(42, payment_y - 25, f"Verified on: {str(date_value).replace('T', ' ')[:19] or '-'}")
    pdf.drawRightString(page_width - 42, payment_y - 25, "Payment mode: UPI")
    pdf.setStrokeColor(border); pdf.line(42, 105, page_width - 42, 105)
    pdf.setFillColor(navy); pdf.setFont("Helvetica-Bold", 9)
    pdf.drawCentredString(page_width / 2, 84, "Thank you for registering for ASSEMBLE.")
    pdf.setFillColor(muted); pdf.setFont("Helvetica", 7.5)
    pdf.drawCentredString(page_width / 2, 68, "This computer-generated receipt confirms the approved registration-fee submission.")
    pdf.drawCentredString(page_width / 2, 54, "For corrections, contact the ASSEMBLE registration committee.")
    pdf.showPage(); pdf.save(); buffer.seek(0)

    return send_file(
        buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"ASSEMBLE_Payment_Receipt_{receipt_number}.pdf",
    )


@app.errorhandler(RequestEntityTooLarge)
def handle_large_upload(_error):
    flash("The uploaded file is too large. Use an image smaller than 2 MB.", "error")
    return redirect(url_for("payment"))


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    session.clear()
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))


@app.route("/admin/logout", methods=["POST"])
@admin_required
def admin_logout():
    """End an administrator session and return to the login page."""
    session.clear()
    flash("Administrator logged out successfully.", "success")
    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").strip().lower()
        phone = re.sub(r"\D", "", request.form.get("phone", ""))
        college_name = request.form.get("college_name", "").strip()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        errors = []

        if len(full_name) < 2:
            errors.append("Enter your full name.")
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            errors.append("Enter a valid email address.")
        if not re.fullmatch(r"[6-9]\d{9}", phone):
            errors.append("Enter a valid 10-digit Indian mobile number.")
        if len(college_name) < 2:
            errors.append("Enter your college or university name.")
        if len(password) < 8:
            errors.append("Password must contain at least 8 characters.")
        if password != confirm_password:
            errors.append("The passwords do not match.")

        if errors:
            for error in errors:
                flash(error, "error")
            return render_template("register.html"), 400

        try:
            auth_client = create_auth_client()
            response = auth_client.auth.sign_up(
                {
                    "email": email,
                    "password": password,
                    "options": {
                        "data": {
                            "full_name": full_name,
                            "phone": phone,
                            "college_name": college_name,
                        }
                    },
                }
            )

            if not response.user:
                flash("Account creation failed. Please try again.", "error")
                return render_template("register.html"), 400

            flash(
                "Account created successfully. Please log in to continue.",
                "success",
            )
            return redirect(url_for("login"))

        except Exception as exc:
            message = str(exc).lower()

            if "already registered" in message or "user_already_exists" in message:
                flash("An account already exists with this email. Please log in.", "error")
            elif "password" in message:
                flash("The password does not meet the security requirements.", "error")
            else:
                app.logger.exception("Supabase registration failed")
                flash("Registration could not be completed. Please try again.", "error")

            return render_template("register.html"), 400

    return render_template("register.html")


if __name__ == "__main__":
    app.run(debug=False)