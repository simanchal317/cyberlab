import { createHash, randomUUID } from "node:crypto";
import { db, achievementsTable, activityLogsTable, categoriesTable, commandsTable, flagsTable, labsTable, learningModulesTable, lessonsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function seedCyberLab() {
  const [existingCategory] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .limit(1);
  if (existingCategory) return;

  const categories = [
    { id: "cat-recon", name: "Reconnaissance", slug: "reconnaissance", labCount: 2, color: "#64f28b" },
    { id: "cat-web", name: "Web Security", slug: "web-security", labCount: 1, color: "#6de4ff" },
    { id: "cat-linux", name: "Linux", slug: "linux", labCount: 1, color: "#f5bf62" },
  ];
  await db.insert(categoriesTable).values(categories);

  await db.insert(usersTable).values([
    { id: "demo-student", name: "Alex Morgan", email: "student@cyberlab.dev", role: "student" },
    { id: "demo-admin", name: "Jordan Lee", email: "admin@cyberlab.dev", role: "admin" },
  ]);

  const labs = [
    {
      id: "lab-surface-scan",
      name: "Surface Scan",
      slug: "surface-scan",
      description: "Map an unfamiliar network, identify exposed services, and turn raw scan output into a clear attack surface.",
      categoryId: "cat-recon",
      difficulty: "Easy",
      estimatedMinutes: 35,
      instructions: "Start by mapping the target. Use the command library to identify open ports and services, then submit the hidden flag discovered in the service banner.",
      objectives: ["Run a focused service scan", "Identify the target's exposed surface", "Document one actionable finding"],
      hints: ["Start with a default script scan.", "The flag is in a service banner, not the page source."],
      requirements: ["Basic terminal familiarity", "Understanding of ports and services"],
      docker: { image: null, tag: null, targetPort: 8080, protocol: "http", network: null, timeoutMinutes: 45, configured: false },
      flagHash: hash("CYBERLAB{surface_scan_complete}"),
      status: "Published",
      accent: "#64f28b",
    },
    {
      id: "lab-hidden-route",
      name: "Hidden Route",
      slug: "hidden-route",
      description: "Trace a web application's behavior and uncover an administrative route hidden in plain sight.",
      categoryId: "cat-web",
      difficulty: "Medium",
      estimatedMinutes: 50,
      instructions: "Inspect the application behavior, enumerate common paths, and follow clues in the response headers to locate the hidden route.",
      objectives: ["Read response metadata", "Enumerate application paths", "Explain the discovery chain"],
      hints: ["Not every clue is visible in the rendered page.", "Check how the server describes itself."],
      requirements: ["HTTP fundamentals", "Basic web enumeration"],
      docker: { image: null, tag: null, targetPort: 3000, protocol: "http", network: null, timeoutMinutes: 60, configured: false },
      flagHash: hash("CYBERLAB{route_discovered}"),
      status: "Published",
      accent: "#6de4ff",
    },
    {
      id: "lab-permission-trail",
      name: "Permission Trail",
      slug: "permission-trail",
      description: "Follow a misconfigured Linux permission chain and recover the final proof without brute force.",
      categoryId: "cat-linux",
      difficulty: "Hard",
      estimatedMinutes: 70,
      instructions: "Use the terminal to inspect the filesystem and reason about ownership, permissions, and executable paths.",
      objectives: ["Inspect file permissions", "Trace an executable path", "Reach the final proof safely"],
      hints: ["Look for the smallest difference between neighboring files.", "A permission can be useful without being writable."],
      requirements: ["Linux command line", "File permission notation"],
      docker: { image: null, tag: null, targetPort: 22, protocol: "tcp", network: null, timeoutMinutes: 90, configured: false },
      flagHash: hash("CYBERLAB{permission_trail}"),
      status: "Published",
      accent: "#f5bf62",
    },
  ];
  await db.insert(labsTable).values(labs);
  await db.insert(flagsTable).values(labs.map((lab) => ({ id: `flag-${lab.id}`, labId: lab.id, valueHash: lab.flagHash! })));

  await db.insert(commandsTable).values([
    { id: "cmd-nmap", name: "Service discovery", tool: "nmap", category: "Reconnaissance", operatingSystem: "Linux / macOS", difficulty: "Easy", command: "nmap -sC -sV <TARGET>", description: "Enumerate common scripts and service versions on a target.", options: [{ flag: "-sC", description: "Run the default script set." }, { flag: "-sV", description: "Probe services for version information." }], example: "nmap -sC -sV 10.10.10.4", relatedLabs: ["lab-surface-scan"] },
    { id: "cmd-curl", name: "HTTP inspection", tool: "curl", category: "Web Security", operatingSystem: "Linux / macOS / Windows", difficulty: "Easy", command: "curl -i <URL>", description: "Request a resource while displaying response headers.", options: [{ flag: "-i", description: "Include response headers." }, { flag: "-s", description: "Keep output quiet except for response data." }], example: "curl -i http://target.local/robots.txt", relatedLabs: ["lab-hidden-route"] },
    { id: "cmd-find", name: "Filesystem search", tool: "find", category: "Linux", operatingSystem: "Linux / macOS", difficulty: "Medium", command: "find <PATH> -type f -perm -4000", description: "Search a filesystem for files matching a permission predicate.", options: [{ flag: "-type f", description: "Limit matches to regular files." }, { flag: "-perm -4000", description: "Match files with the SUID bit set." }], example: "find / -type f -perm -4000 2>/dev/null", relatedLabs: ["lab-permission-trail"] },
  ]);

  const modules = [
    { id: "module-foundations", title: "Security Foundations", description: "Build the mental models that make every later command more useful.", category: "Cybersecurity Fundamentals", level: "Foundations", accent: "#64f28b", published: true },
    { id: "module-networking", title: "Network Reconnaissance", description: "Learn how defenders and testers turn network signals into a map.", category: "Reconnaissance", level: "Intermediate", accent: "#6de4ff", published: true },
  ];
  await db.insert(learningModulesTable).values(modules);
  await db.insert(lessonsTable).values([
    { id: "lesson-threat-models", moduleId: "module-foundations", title: "Threat models in practice", durationMinutes: 12, position: 1 },
    { id: "lesson-attack-surface", moduleId: "module-foundations", title: "Reading an attack surface", durationMinutes: 18, position: 2 },
    { id: "lesson-scanning", moduleId: "module-networking", title: "A scanner is a question", durationMinutes: 15, position: 1 },
    { id: "lesson-service-fingerprints", moduleId: "module-networking", title: "Service fingerprints", durationMinutes: 22, position: 2 },
  ]);
  await db.insert(achievementsTable).values([
    { id: "achievement-first-step", name: "First Signal", description: "Complete your first lab.", icon: "signal", target: 1 },
    { id: "achievement-command-line", name: "Command Line", description: "Learn five commands.", icon: "terminal", target: 5 },
    { id: "achievement-streak", name: "Keep the Thread", description: "Maintain a three-day learning streak.", icon: "flame", target: 3 },
  ]);
  await db.insert(activityLogsTable).values([
    { id: randomUUID(), userId: "demo-student", type: "lab", title: "Surface Scan is ready", description: "A new reconnaissance lab is available.", },
    { id: randomUUID(), userId: "demo-student", type: "learning", title: "Continue Network Reconnaissance", description: "Pick up where you left off.", },
  ]);
}