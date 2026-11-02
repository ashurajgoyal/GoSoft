/** Original starter articles for the blog CMS (editable/removable from Super Admin → Blog). */
export const BLOG_CATEGORIES = ['Billing & GST', 'HR & Payroll', 'Productivity', 'Business Growth'];

export const BLOG_POSTS = [
  {
    title: 'How to Choose the Best Billing Software in India', category: 'Billing & GST', tags: ['billing', 'gst', 'small business'],
    excerpt: 'A practical checklist for picking billing software that saves time, keeps you GST-compliant and grows with your business.',
    content: `Choosing billing software is one of the first technology decisions a growing business makes — and one of the hardest to undo. Here is what actually matters.

## 1. GST should be built in, not bolted on
Your software should split tax into CGST + SGST or IGST automatically based on the place of supply, store HSN/SAC codes on every item and produce a rate-wise tax summary for filing.

## 2. Numbering that follows the financial year
Invoice series should reset with each financial year (for example INV/2026-27/0001) and never skip or duplicate numbers.

## 3. Credit notes, debit notes and receipts
Real businesses issue returns, corrections and part payments. Make sure these are first-class documents linked to the original invoice.

## 4. Know who owes you money
An outstanding report and a customer ledger turn billing software into a cash-flow tool.

## 5. Room to grow
Pick a platform where HR, payroll and projects can live alongside billing, so you are not migrating again in two years.

**Bottom line:** test the GST calculation, the numbering and the reports during your free trial — those three tell you most of what you need to know.`,
  },
  {
    title: 'GST Billing Explained: CGST, SGST and IGST in Plain Language', category: 'Billing & GST', tags: ['gst', 'invoicing'],
    excerpt: 'When do you charge CGST and SGST, and when IGST? A simple guide with examples.',
    content: `GST confuses many first-time business owners, but the core rule is simple.

## Intra-state vs inter-state
- **Same state** (your state = place of supply): charge **CGST + SGST**, each half of the rate. An 18% item becomes 9% CGST + 9% SGST.
- **Different state**: charge **IGST** at the full rate — 18% IGST.

## What is the place of supply?
For most goods it is where the goods are delivered; for most services it is the location of the customer. The first two digits of a registered customer's GSTIN tell you their state code.

## Example
You are in Rajasthan (08) and bill ₹10,000 + 18%:
- Customer in Jaipur → ₹900 CGST + ₹900 SGST
- Customer in Mumbai (27) → ₹1,800 IGST

## Keep it automatic
Good billing software reads your state and the customer's state and applies the right split for you. Always confirm specific cases with your tax advisor.`,
  },
  {
    title: 'The Complete HRMS Software Guide for Growing Teams', category: 'HR & Payroll', tags: ['hrms', 'hr'],
    excerpt: 'What an HRMS does, which features matter first, and how to roll one out without disrupting your team.',
    content: `Once a team grows past 10–15 people, spreadsheets and WhatsApp groups stop working for HR.

## What an HRMS covers
Employee records, documents, attendance, leave, holidays, payroll inputs and self-service for employees.

## Start with these three
1. **Employee master** — one clean record per person with department, manager and joining date.
2. **Leave management** — policies, balances and approvals in one place.
3. **Attendance** — check-in/out that feeds payroll automatically.

## Roll-out tips
- Import employees first and verify every record.
- Configure leave types and holidays before inviting staff.
- Invite managers before employees so approvals work from day one.

## Protect sensitive data
Salary and bank details should be visible only to HR and payroll roles. Role-based permissions make that enforceable rather than a matter of trust.`,
  },
  {
    title: 'Payroll Software Guide: PF, ESI, PT and TDS Basics', category: 'HR & Payroll', tags: ['payroll', 'compliance'],
    excerpt: 'Understand the statutory deductions on an Indian payslip and how payroll software calculates them.',
    content: `Every Indian payslip carries a few statutory deductions. Here is what each one is.

## Provident Fund (PF)
Typically 12% of basic wages from the employee, matched by the employer. Many companies apply the contribution on a wage ceiling (commonly ₹15,000).

## Employees' State Insurance (ESI)
Applies to employees below the wage limit. Employee and employer contribute a percentage of gross wages.

## Professional Tax (PT)
A state tax with monthly slabs that vary by state. Some states do not levy it at all.

## TDS on salary
Income tax deducted monthly based on projected annual income and the employee's declarations.

## Why configurable rules matter
Rates, ceilings and slabs change. GO SOFT keeps them as settings so HR can update them without waiting for a software release. Always confirm current rates with your payroll consultant.`,
  },
  {
    title: 'Employee Attendance Management: A Practical Playbook', category: 'HR & Payroll', tags: ['attendance'],
    excerpt: 'Set shift rules, handle late arrivals fairly and connect attendance to payroll.',
    content: `Attendance tracking works when the rules are clear and the tool is effortless.

## Define the rules once
Shift start and end, a grace period for late arrivals, the hours that count as a full day and a half day, and your weekly offs.

## Make check-in one tap
Employees check in and out from their phone or browser; breaks are tracked separately so working hours are accurate.

## Allow corrections — with approval
People forget to check out. A correction request approved by the manager keeps records honest without HR chasing anyone.

## Close the loop with payroll
Overtime hours and loss-of-pay days should flow straight into the payroll run, so nobody re-keys data at month end.`,
  },
  {
    title: '7 Habits That Boost Business Productivity', category: 'Productivity', tags: ['productivity', 'management'],
    excerpt: 'Simple operating habits that help small teams get more done with less stress.',
    content: `Productivity is less about working longer and more about removing friction.

1. **One source of truth.** Keep customers, invoices, people and tasks in one system.
2. **Weekly priorities.** Every Monday, agree on the three outcomes that matter most.
3. **Clear ownership.** Every task has one owner and a due date.
4. **Short feedback loops.** Review work in progress, not just finished work.
5. **Automate the boring parts.** Reminders, numbering and calculations should happen on their own.
6. **Protect focus time.** Batch meetings so people get uninterrupted hours.
7. **Look at the numbers.** A weekly glance at revenue, attendance and open tasks spots problems early.`,
  },
  {
    title: 'Task Management for Teams: Kanban Made Simple', category: 'Productivity', tags: ['tasks', 'kanban', 'projects'],
    excerpt: 'How to use a Kanban board to make work visible, limit bottlenecks and deliver on time.',
    content: `A Kanban board shows every piece of work and where it stands.

## The columns
**To Do → In Progress → Review → Completed**, plus **On Hold** for blocked work.

## The rules that make it work
- Limit work in progress: finish before starting something new.
- Use the Review column for anything that needs approval.
- Keep tasks small enough to finish in a few days; use checklists for the steps.

## Add structure with projects
Group tasks into projects with a manager, members and a deadline. Progress then updates itself as tasks are completed.

## Different views for different people
Managers like the board and timeline; individuals like "My Tasks" and the calendar. Pick software that offers both.`,
  },
  {
    title: 'The Startup Business Software Stack in 2026', category: 'Business Growth', tags: ['startup', 'software'],
    excerpt: 'Which business software a new company really needs in year one — and what can wait.',
    content: `Early-stage companies often buy too many tools too soon. Here is a lean stack.

## Year-one essentials
- **Billing & GST** — get paid correctly from your first invoice.
- **Team & HR basics** — employee records, leave and attendance.
- **Payroll** — once you have more than a handful of salaried staff.
- **Task management** — so work is visible as the team grows.

## What can wait
Complex ERPs, multiple disconnected point solutions and custom-built internal tools.

## Choose connected over best-of-breed
Every extra tool adds logins, data silos and monthly fees. A single platform where billing, people and projects share data keeps the team fast — and makes reporting effortless.`,
  },
];
