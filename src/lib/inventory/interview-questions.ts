export interface InterviewQuestion {
  skill: string;
  order: number;
}

export interface InterviewRole {
  roleKey: string;
  roleLabel: string;
  questions: InterviewQuestion[];
}

export const INTERVIEW_ROLES: InterviewRole[] = [
  {
    roleKey: "application_developer",
    roleLabel: "Application Developer",
    questions: [
      { skill: "SDLC", order: 1 },
      { skill: "Coding Skills Android", order: 2 },
      { skill: "Solution Design", order: 3 },
      { skill: "Unit/UI Tests", order: 4 },
      { skill: "Troubleshoot/Debug", order: 5 },
      { skill: "UI Design", order: 6 },
      { skill: "Liaise with Product Team", order: 7 },
      { skill: "Legacy Apps Quality", order: 8 },
      { skill: "Research Mobile Products", order: 9 },
    ],
  },
  {
    roleKey: "mechanical_engineer",
    roleLabel: "Product Design - Mechanical Engineer",
    questions: [
      { skill: "Bachelors Mechanical Engineering", order: 1 },
      { skill: "2D/3D Design Software", order: 2 },
      { skill: "Collaborate on Timelines", order: 3 },
      { skill: "Industry/Engineering Knowledge", order: 4 },
      { skill: "Analyze Data/Creative Solutions", order: 5 },
    ],
  },
  {
    roleKey: "firmware_developer",
    roleLabel: "Firmware Developer",
    questions: [
      { skill: "Bachelors CS/CE", order: 1 },
      { skill: "Embedded Software Code", order: 2 },
      { skill: "Test Software", order: 3 },
      { skill: "Fix Bugs/Optimize", order: 4 },
      { skill: "Maintain Software", order: 5 },
      { skill: "Document Values", order: 6 },
    ],
  },
  {
    roleKey: "application_tester",
    roleLabel: "Application Tester",
    questions: [
      { skill: "Bachelors CS/Related", order: 1 },
      { skill: "Review Requirements", order: 2 },
      { skill: "Execute Tests", order: 3 },
      { skill: "Analyze Results", order: 4 },
      { skill: "Prepare Reports", order: 5 },
      { skill: "Interact with Clients", order: 6 },
      { skill: "Design Reviews", order: 7 },
      { skill: "Test Reports", order: 8 },
    ],
  },
  {
    roleKey: "supplier_management",
    roleLabel: "Supplier Management",
    questions: [
      { skill: "Bachelors Science/Sales", order: 1 },
      { skill: "Source Products", order: 2 },
      { skill: "Negotiate Contracts", order: 3 },
      { skill: "Create PO/PI/GRN", order: 4 },
      { skill: "Logistics Strategy", order: 5 },
      { skill: "Oversee Distribution", order: 6 },
      { skill: "Track Goods", order: 7 },
      { skill: "Forecasts/Inventory", order: 8 },
      { skill: "Supplier Relationships", order: 9 },
      { skill: "Validate Raw Materials", order: 10 },
    ],
  },
  {
    roleKey: "sales_marketing",
    roleLabel: "Sales and Marketing",
    questions: [
      { skill: "Bachelors Marketing/Business", order: 1 },
      { skill: "Promote Brands", order: 2 },
      { skill: "Regulatory Requirements", order: 3 },
      { skill: "Research Opportunities", order: 4 },
      { skill: "Market Data/Reports", order: 5 },
      { skill: "Sales Plans", order: 6 },
      { skill: "Recruit/Train Teams", order: 7 },
      { skill: "Client Relationships", order: 8 },
      { skill: "Maintain Relationships", order: 9 },
    ],
  },
  {
    roleKey: "regulatory_compliance",
    roleLabel: "Regulatory and Compliance",
    questions: [
      { skill: "Bachelors Engineering/Science", order: 1 },
      { skill: "Write Technical Documents", order: 2 },
      { skill: "Maintain Regulatory Files", order: 3 },
      { skill: "Prepare Responses", order: 4 },
      { skill: "Stay Abreast Regulations", order: 5 },
      { skill: "Assess Complaints", order: 6 },
      { skill: "Review Labels", order: 7 },
      { skill: "Support Audits", order: 8 },
      { skill: "Clinical Trial Applications", order: 9 },
    ],
  },
  {
    roleKey: "factory_site_manager",
    roleLabel: "Factory Site Manager",
    questions: [
      { skill: "Develop Strategies", order: 1 },
      { skill: "Screen/Recruit Workers", order: 2 },
      { skill: "Quality Control", order: 3 },
      { skill: "Machinery Maintenance", order: 4 },
      { skill: "Analyze Production Data", order: 5 },
      { skill: "Production Reports", order: 6 },
      { skill: "Inspect Products", order: 7 },
    ],
  },
];

/** Map employee_role DB values to interview role keys */
export const EMPLOYEE_ROLE_TO_INTERVIEW: Record<string, string> = {
  operator: "application_developer",
  supervisor: "factory_site_manager",
  qc_inspector: "application_tester",
  production_manager: "mechanical_engineer",
};

export function getInterviewRole(employeeRole: string): InterviewRole | undefined {
  const interviewKey = EMPLOYEE_ROLE_TO_INTERVIEW[employeeRole];
  if (interviewKey) return INTERVIEW_ROLES.find((r) => r.roleKey === interviewKey);
  return INTERVIEW_ROLES.find((r) => r.roleKey === employeeRole);
}
