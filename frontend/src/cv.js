// Finds skills in CV text. It runs in the browser: the CV is never uploaded or stored.
//
// How it decides (simple on purpose, so a person can see why a skill was found):
//   1. exact   the skill's own name appears in the CV ("customer service")
//   2. synonym a common everyday word for it appears ("Excel" or "bookkeeping")
//   3. maybe   all the key words of the skill's name appear in one sentence. Shown as "maybe",
//              never added without the person clicking it.

// everyday phrase  ->  skill names (must match skills.csv exactly; cv.check.mjs tests this)
export const SYNONYMS = {
  // accounting and finance
  "bookkeeping": ["maintain financial records", "accounting entries", "manage accounts"],
  "book keeping": ["maintain financial records", "accounting entries"],
  "accounts payable": ["manage accounts", "issue sales invoices", "control of expenses"],
  "accounts receivable": ["follow up accounts receivables", "monitor billing procedures"],
  "invoice": ["issue sales invoices", "monitor billing procedures"],
  "invoicing": ["issue sales invoices", "monitor billing procedures"],
  "billing": ["monitor billing procedures", "allocate bills"],
  "reconcil": ["perform balance sheet operations", "identify accounting errors", "prepare trial accounting balances"],
  "general ledger": ["manage the general ledger"],
  "ledger": ["manage the general ledger"],
  "payroll": ["manage payroll reports"],
  "petty cash": ["handle petty cash"],
  "cash handling": ["manage cash desk", "handle financial transactions"],
  "cash management": ["manage cash desk", "handle financial transactions"],
  "tax": ["calculate tax", "tax legislation"],
  "taxes": ["calculate tax", "tax legislation"],
  "tax return": ["prepare tax returns forms"],
  "financial audit": ["conduct financial audits", "prepare financial auditing reports"],
  "carbon footprint": ["analyse environmental data", "assess environmental impact"],
  "scientific research": ["perform scientific research"],
  "qualitative research": ["conduct qualitative research"],
  "quantitative research": ["conduct quantitative research"],
  "taxation": ["tax legislation", "calculate tax"],
  "auditing": ["conduct financial audits", "prepare financial auditing reports"],
  "ifrs": ["international financial reporting standards"],
  "gaap": ["national generally accepted accounting principles"],
  "budget": ["manage budgets", "support development of annual budget"],
  "budgeting": ["manage budgets", "support development of annual budget"],
  "financial reporting": ["financial statements", "prepare financial statements"],
  "financial analysis": ["interpret financial statements", "analyse market financial trends"],
  "depreciation": ["depreciation"],
  "fraud": ["fraud detection", "detect financial crime"],
  "sap": ["use accounting systems"],
  "quickbooks": ["use accounting systems"],
  "xero": ["use accounting systems"],
  "sage": ["use accounting systems"],
  "oracle financials": ["use accounting systems"],
  "accounting software": ["use accounting systems"],
  "spreadsheet": ["use a computer", "have computer literacy"],
  "microsoft excel": ["use a computer", "have computer literacy"],
  "excel": ["use a computer", "have computer literacy"],
  "microsoft office": ["use a computer", "have computer literacy"],
  "ms office": ["use a computer", "have computer literacy"],
  "typing": ["type on electronic devices"],
  // office and admin
  "data entry": ["fill out forms", "handle paperwork"],
  "filing": ["handle paperwork", "organise business documents"],
  "scheduling": ["plan schedule", "fix meetings"],
  "appointment": ["fix meetings"],
  "calendar management": ["fix meetings", "manage personnel agenda"],
  "travel arrangement": ["organise travel arrangements for staff"],
  "document control": ["document management"],
  "record keeping": ["carry out records management", "oversee record management"],
  "records management": ["carry out records management", "oversee record management"],
  "multitask": ["perform multiple tasks at the same time"],
  "multi-task": ["perform multiple tasks at the same time"],
  "time management": ["prioritise tasks", "plan schedule"],
  "prioriti": ["prioritise tasks"],
  "attention to detail": ["identify accounting errors"],
  // customer service and sales
  "call centre": ["communicate by telephone", "customer service"],
  "call center": ["communicate by telephone", "customer service"],
  "helpdesk": ["customer service", "provide customer follow-up services"],
  "help desk": ["customer service", "provide customer follow-up services"],
  "customer support": ["customer service", "communicate with customers"],
  "customer care": ["customer service", "guarantee customer satisfaction"],
  "client service": ["customer service", "communicate with customers"],
  "customer complaint": ["perform escalation procedure", "guarantee customer satisfaction"],
  "complaint handling": ["perform escalation procedure", "guarantee customer satisfaction"],
  "telephone": ["communicate by telephone"],
  "crm": ["use customer relationship management software"],
  "salesforce": ["use customer relationship management software"],
  "hubspot": ["use customer relationship management software"],
  "upselling": ["upsell products"],
  "cross-sell": ["upsell products"],
  "sales": ["sales activities", "carry out active selling"],
  "refund": ["process refunds"],
  "order processing": ["process customer orders"],
  "customer feedback": ["measure customer feedback"],
  // marketing and communication
  "seo": ["web analytics", "study website behaviour patterns"],
  "google analytics": ["web analytics", "study website behaviour patterns"],
  "social media": ["create advertisements", "advertising techniques"],
  "advertising": ["advertising techniques", "create advertisements"],
  "campaign": ["collaborate in the development of marketing strategies", "create advertisements"],
  "marketing strategy": ["collaborate in the development of marketing strategies"],
  "copywriting": ["create advertisements", "develop creative ideas"],
  "content creation": ["develop creative ideas", "create advertisements"],
  "market research": ["perform market research", "market research"],
  "survey": ["conduct public surveys", "design questionnaires", "tabulate survey results"],
  "questionnaire": ["design questionnaires"],
  "customer segmentation": ["customer segmentation"],
  "consumer behaviour": ["analyse consumer buying trends", "customer insight"],
  "consumer behavior": ["analyse consumer buying trends", "customer insight"],
  "canva": ["design graphics"],
  "graphic design": ["graphic design", "design graphics"],
  "photoshop": ["Adobe Photoshop"],
  "illustrator": ["Adobe Illustrator"],
  "presentation": ["prepare presentation material", "conduct public presentations"],
  "public speaking": ["conduct public presentations"],
  "report writing": ["present reports", "write inspection reports"],
  "networking": ["develop professional network"],
  "negotiat": ["show diplomacy", "manage contracts"],
  "conflict": ["apply conflict management"],
  // data
  "sql": ["query languages", "database"],
  "mysql": ["query languages", "database"],
  "postgres": ["query languages", "database"],
  "sparql": ["SPARQL"],
  "database": ["database", "manage database"],
  "power bi": ["business intelligence", "deliver visual presentation of data"],
  "powerbi": ["business intelligence", "deliver visual presentation of data"],
  "tableau": ["business intelligence", "deliver visual presentation of data"],
  "dashboard": ["deliver visual presentation of data", "business intelligence"],
  "data visuali": ["deliver visual presentation of data"],
  "data analysis": ["perform data analysis", "analyse big data"],
  "data analytics": ["perform data analysis", "analyse big data"],
  "data cleaning": ["perform data cleansing", "normalise data"],
  "data cleansing": ["perform data cleansing", "normalise data"],
  "data mining": ["perform data mining", "data mining"],
  "statistic": ["statistics", "apply statistical analysis techniques"],
  "machine learning": ["build predictive models"],
  "predictive model": ["build predictive models"],
  "forecast": ["forecast economic trends", "build predictive models"],
  "business analysis": ["perform business analysis", "business analysis"],
  "business intelligence": ["business intelligence"],
  "reporting": ["present reports", "report analysis results"],
  "cloud": ["cloud technologies"],
  "aws": ["cloud technologies"],
  "azure": ["cloud technologies"],
  "backup": ["perform backups"],
  // health admin
  "medical record": ["health records management", "patient record storage", "identify patients' medical records"],
  "patient record": ["health records management", "patient record storage"],
  "electronic health record": ["use electronic health records management system"],
  "emr": ["use electronic health records management system"],
  "medical terminology": ["medical terminology"],
  "icd": ["clinical coding", "perform clinical coding procedures"],
  "medical coding": ["clinical coding", "perform clinical coding procedures"],
  "insurance claim": ["process medical insurance claims"],
  "hipaa": ["information confidentiality", "maintain healthcare user data confidentiality"],
  "confidentiality": ["information confidentiality"],
  "pdpa": ["information confidentiality"],
  // teaching
  "teaching": ["apply teaching strategies", "conduct educational activities"],
  "lesson plan": ["prepare lesson content"],
  "tutoring": ["tutor students", "assist students in their learning"],
  "tutor": ["tutor students", "assist students in their learning"],
  "classroom": ["conduct educational activities"],
  "curriculum": ["curriculum objectives"],
  "mentoring": ["assist students in their learning", "give constructive feedback"],
  "student assessment": ["assess students"],
  "grading": ["assess students"],
  // environment, energy, engineering
  "sustainability": ["promote environmental awareness", "develop environmental policy"],
  "esg": ["report on environmental issues", "develop environmental policy"],
  "environmental impact": ["assess environmental impact"],
  "environmental audit": ["carry out environmental audits"],
  "iso 14001": ["carry out environmental audits", "environmental policy"],
  "waste management": ["advise on waste management procedures"],
  "recycling": ["advise on waste management procedures"],
  "solar": ["solar energy"],
  "photovoltaic": ["types of photovoltaic panels", "mount photovoltaic panels"],
  "pv system": ["mount photovoltaic panels", "install inverter"],
  "inverter": ["install inverter"],
  "electrical": ["electricity", "install electrical and electronic equipment"],
  "wiring": ["electrical wiring plans", "install electrical and electronic equipment"],
  "autocad": ["use CAD software", "technical drawings"],
  "cad": ["use CAD software", "technical drawings"],
  "site inspection": ["write inspection reports", "inspect construction supplies"],
  "health and safety": ["ensure compliance with safety legislation", "follow health and safety procedures in construction"],
  "occupational safety": ["ensure compliance with safety legislation"],
  "compliance": ["comply with legal regulations"],
  "regulatory": ["comply with legal regulations"],
  // general / soft
  "project management": ["project management", "perform project management"],
  "project manager": ["project management", "perform project management"],
  "leadership": ["supervise staff", "liaise with managers"],
  "team lead": ["supervise staff"],
  "supervis": ["supervise staff"],
  "team management": ["supervise staff"],
  "communication skill": ["use communication techniques", "listen actively"],
  "active listening": ["listen actively"],
  "stakeholder": ["liaise with managers", "develop professional network"],
  "problem solving": ["analyse problems for opportunities"],
  "problem-solving": ["analyse problems for opportunities"],
  "interview": ["interview people", "conduct research interview"],
  "recruit": ["recruit employees"],
  "bahasa": ["speak different languages"],
  "mandarin": ["speak different languages"],
  "multilingual": ["speak different languages"],
  "bilingual": ["speak different languages"],
  "multicultural": ["work in a multicultural environment in health care"],
};

const STOP = new Set(("perform manage use carry out conduct maintain ensure apply follow provide work with of in on to for and the a an by at from into up that their or is are be as it its this these those"
  + " related various different general types type").split(" "));
// words so common that finding one alone says nothing
const WEAK = new Set(["data", "information", "customer", "customers", "service", "services", "management", "project", "team", "report", "reports", "plan", "record", "records", "analysis", "document", "documents", "process", "processes", "legislation", "regulations", "procedures", "activities", "systems", "system"]);

const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
const words = (s) => norm(s).match(/[a-z0-9+#]+/g) ?? [];
// crude stem: "calculations", "calculate", "calculating" all become "calcu"; "taxes" becomes "tax"
function stem(w) {
  if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
  return w.length > 5 ? w.slice(0, 5) : w;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// phrase at the start of a word ("reconcil" finds reconcile, reconciling, reconciliation)
// short phrases (sap, sql, tax, cad...) must be a whole word, longer ones may continue ("reconcil" finds reconciling)
const hasPhrase = (text, p) => new RegExp("(^|[^a-z0-9])" + esc(p) + (p.length >= 6 ? "[a-z]*" : "(?![a-z0-9])"), "i").test(text);

/**
 * @param {string} text       the CV text
 * @param {{skill_id:string,name:string}[]} catalogue   all skills (from /api/skills)
 * @returns {{sure: Found[], maybe: Found[]}}   Found = {skill_id, name, why}
 */
export function findSkills(text, catalogue) {
  const lower = norm(text ?? "");
  if (lower.trim().length < 3 || !catalogue?.length) return { sure: [], maybe: [] };
  const byName = new Map(catalogue.map((s) => [s.name.toLowerCase(), s]));
  const sure = new Map(); // skill_id -> Found

  const add = (skill, why) => { if (skill && !sure.has(skill.skill_id)) sure.set(skill.skill_id, { ...skill, why }); };

  // 1. the skill's own name (also without a bracket, e.g. "GIMP")
  for (const s of catalogue) {
    const full = s.name.toLowerCase();
    const short = full.replace(/\s*\(.*\)\s*/, "").trim();
    if (hasPhrase(lower, full)) add(s, `“${s.name}”`);
    else if (short.length >= 3 && short !== full && hasPhrase(lower, short)) add(s, `“${short}”`);
  }
  // 2. everyday words
  for (const [phrase, names] of Object.entries(SYNONYMS)) {
    if (!hasPhrase(lower, phrase)) continue;
    for (const n of names) add(byName.get(n.toLowerCase()), `“${phrase}”`);
  }
  // 3. maybe: every key word of the skill is in one sentence
  const clauses = lower.split(/[.\n;•]|\s-\s/).map((c) => new Set(words(c).map(stem)));
  const maybe = [];
  for (const s of catalogue) {
    if (sure.has(s.skill_id)) continue;
    const key = words(s.name).filter((w) => !STOP.has(w));
    if (key.length < 2 || key.every((w) => WEAK.has(w))) continue;
    const stems = key.map(stem);
    const hit = clauses.find((c) => stems.every((w) => c.has(w)));
    if (hit) maybe.push({ ...s, why: "the words " + key.map((w) => `“${w}”`).join(" + ") });
  }
  return { sure: [...sure.values()], maybe: maybe.slice(0, 12) };
}