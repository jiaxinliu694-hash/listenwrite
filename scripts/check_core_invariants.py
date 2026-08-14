from pathlib import Path
import re, subprocess, tempfile

s=Path('index.html').read_text(encoding='utf-8')
errors=[]

def must(desc, cond):
    if not cond: errors.append(desc)

def fn(name):
    m=re.search(r'function '+re.escape(name)+r'\([^)]*\)\{.*?(?=\nfunction [A-Za-z_$]|\nvar statRange=|\nload\(\);)',s,re.S)
    return m.group(0) if m else ''

# Syntax check the actual inline application JavaScript.
m=re.search(r'<script>(.*)</script>',s,re.S)
must('inline script exists', bool(m))
if m:
    with tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf-8') as f:
        f.write(m.group(1)); tmp=f.name
    r=subprocess.run(['node','--check',tmp],capture_output=True,text=True)
    must('JavaScript syntax is valid: '+(r.stderr.strip() or 'unknown parse error'), r.returncode==0)

listen_next=fn('next')
listen_judge=fn('judge')
today_data=fn('todayScopeData')
plan_status=fn('dailyPlanStatus')
start=fn('start')
type_judge=fn('typeJudge')
type_finish=fn('typeFinish')

must('separate retry pool is installed', 'data-separate-retry-pool-v1' in s and 'sess.retry' in s)
must('listening base queue is not extended on failure', 'sess.q.push' not in listen_next)
must('listening retry queue rotates separately', 'sess.retry.shift()' in listen_next and 'sess.retry.push(first)' in listen_next)
must('new/review denominators are frozen from daily plan', 'totals:totals' in start and 'p.newIds.length' in start and 'p.reviewIds.length' in start)
must('daily plan persists across exits/re-entry', 'S.dailyPlans' in s and 'extendDailyPlan(getDailyPlan(books),books)' in start)
must('Today stats only use listening events', "e.mode==='listen'" in today_data)
must('daily plan completion only uses listening events', 'latestTodayListenEvent' in plan_status and 'latestTodayEvent' not in plan_status)
must('base-card judgment edits synchronize retry membership', 'sessionRemoveRetry(w)' in listen_judge and 'sessionAddRetry(w)' in listen_judge)
must('hand judgments bind to exact event IDs', 'eventId' in type_judge and 'ts.meta[ts.i]' in type_judge)
must('hand judgment edits do not search arbitrary last event', 'reverse().find' not in type_judge)
must('hand summary is based on final per-word state', 'lastBy' in type_finish and '最终熟悉' in type_finish and '最终不熟' in type_finish)
must('multi-month calendar remains installed', 'data-calendar-month-v3' in s and 'calPrev' in s and 'calNext' in s)

# Guard against the original bug patterns returning later.
must('old listening retry append pattern is absent', "if(sess.res==='bad')sess.q.push" not in s)
must('old mixed-mode Today query is absent', "todayEvents=S.events.filter(function(e){return e.date===d&&ids.has(e.wordId)})" not in s)

if errors:
    print('CORE INVARIANT CHECK FAILED')
    for e in errors: print('- '+e)
    raise SystemExit(1)
print('CORE INVARIANT CHECK PASSED')
print('Verified: fixed denominators, separate retry pool, persistent daily plans, mode separation, exact judgment edits, final-state summaries, JS syntax.')
