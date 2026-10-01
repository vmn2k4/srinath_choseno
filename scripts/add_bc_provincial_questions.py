#!/usr/bin/env python3
"""
Seeds the candidate questionnaire for "2026 BC Provincial Election" (MLA).

Mirrors the shape of the existing BC municipal questionnaires (election_questions
+ election_question_options, allow_context + allow_video @ 30s) but is NOT
required -- a 3-week snap election is a short window and a hard requirement
would block candidates from submitting at all.

Idempotent: a question is skipped if one with identical question_text already
exists for the election, so re-running is safe. Existing questions/answers are
never modified or deleted.

Usage: DATABASE_URL=... python3 scripts/add_bc_provincial_questions.py [--dry-run]
"""
import os
import subprocess
import sys

DB_URL = os.environ["DATABASE_URL"]
ELECTION_NAME = "2026 BC Provincial Election"
MAX_ANSWER_SECONDS = 30

# (question_text, question_type, [options])
QUESTIONS = [
    ("What are your educational credentials, work history, experience, and key achievements that qualify you to be an MLA?",
     "text", []),
    ("RTB dispute hearings take months, leaving rent unpaid and tenants facing bad-faith evictions. Will you establish a fast-track eviction process for non-payment of rent, or will you tie rent control to the unit instead of the tenant?",
     "single_choice",
     ["Fast-track eviction process for non-payment of rent", "Tie rent control to the unit instead of the tenant", "Both", "Neither"]),
    ("Provincial rules now require municipalities to allow multi-unit housing in single-family neighbourhoods. Will you roll back these density mandates until the province funds the schools and local infrastructure (such as school seats, water and sewer upgrades) needed to support growth, or keep them in place?",
     "single_choice",
     ["Roll back the mandates until infrastructure is funded", "Keep the mandates", "Keep the mandates and attach infrastructure funding"]),
    ("Recent court rulings and Land Act discussions have sparked fears over private property and fee-simple land titles. Will you vote to completely repeal DRIPA, amend it to explicitly protect private land, or keep it exactly as it is?",
     "single_choice", ["Completely repeal DRIPA", "Amend it to explicitly protect private land", "Keep it exactly as it is"]),
    ("With emergency rooms facing rolling closures and hundreds of thousands lacking a family doctor, what immediate policy will you pass next month to attach families to a dedicated GP and end 10-hour ER waits without burning out existing staff?",
     "text", []),
    ("Do you support involuntary treatment for individuals with severe, repeated overdoses and brain injuries, or should provincial tax dollars strictly support voluntary treatment and harm reduction?",
     "single_choice",
     ["Support involuntary treatment", "Voluntary treatment and harm reduction only", "Support with conditions"]),
    ("Violent repeat offenders and open street crime continue to disrupt local business districts and transit hubs. How will your government use provincial prosecution directives and strict bail enforcement to keep repeat offenders off our streets?",
     "text", []),
    ("Alberta and national industry groups want new crude export capacity to the Pacific coast. Will you vote to oppose any new oil pipelines and uphold the North Coast tanker ban, or will you support expanding pipeline corridors through BC to boost national revenue?",
     "single_choice",
     ["Oppose new pipelines and uphold the tanker ban", "Support expanding pipeline corridors through BC", "Support with conditions"]),
    ("With BC facing an annual budget deficit in the billions of dollars, your party is promising costly new programs and tax relief. Name three specific provincial programs, ministries, or capital projects you will cut or defund to pay for your platform.",
     "text", []),
    ("What specific local issue in this riding are you willing to take a public stand on and vote against your own party leadership?",
     "text", []),
    ("What is your position on SOGI 123 in BC schools, and why? Explain whether you would keep, amend, or remove it.",
     "text", []),
]


def q(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    sql = ["BEGIN;", f"""DO $$
DECLARE v_eid uuid; v_qid uuid; v_added int := 0;
BEGIN
  SELECT id INTO v_eid FROM public.elections WHERE name = {q(ELECTION_NAME)};
  IF v_eid IS NULL THEN RAISE EXCEPTION 'election not found'; END IF;"""]
    for rank, (text, qtype, opts) in enumerate(QUESTIONS):
        sql.append(f"""  IF NOT EXISTS (SELECT 1 FROM public.election_questions WHERE election_id = v_eid AND question_text = {q(text)}) THEN
    INSERT INTO public.election_questions
      (election_id, question_text, question_type, required, allow_context, allow_video, visible_to_public, rank, max_answer_seconds)
    VALUES (v_eid, {q(text)}, '{qtype}', false, {'true' if opts else 'false'}, true, true, {rank}, {MAX_ANSWER_SECONDS})
    RETURNING id INTO v_qid;""")
        for i, o in enumerate(opts):
            sql.append(f"    INSERT INTO public.election_question_options (question_id, option_text, rank) VALUES (v_qid, {q(o)}, {i});")
        sql.append("    v_added := v_added + 1;\n  END IF;")
    sql.append("  RAISE NOTICE 'added % questions', v_added;\nEND $$;")
    sql.append("ROLLBACK;" if "--dry-run" in sys.argv else "COMMIT;")
    r = subprocess.run(["psql", DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-c", "\n".join(sql)],
                       capture_output=True, text=True)
    print(r.stdout, r.stderr)
    sys.exit(r.returncode)


main()
