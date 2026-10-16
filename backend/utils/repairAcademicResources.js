const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const AcademicResource = require('../models/AcademicResource');

dotenv.config();

const categoryDirectories = {
  NOTES: 'notes',
  STUDY_MATERIAL: 'study-materials',
  QUESTION_BANK: 'question-banks',
  PREVIOUS_PAPER: 'previous-papers'
};

const demoRecordReplacements = {
  'Traversal Attack Simulation': {
    title: 'Cybersecurity: Threat Modeling Basics',
    subject: 'Cybersecurity'
  },
  'Resource With Deleted File': {
    title: 'Database Systems: SQL and Relational Model',
    subject: 'Database Management Systems'
  },
  'Executable Upload Attempt': {
    title: 'Secure File Upload Validation Guide',
    subject: 'Cybersecurity'
  },
  'Compiler Design 2025 End-Sem Paper': {
    title: 'Compiler Design: Sample End-Semester Paper',
    subject: 'Compiler Design'
  }
};

const subjectContent = [
  {
    keywords: ['database', 'dbms', 'sql'],
    sections: [
      'Relational model: represent data with relations (tables), tuples (rows), and attributes (columns).',
      'Keys: a primary key uniquely identifies a row; foreign keys maintain relationships between tables.',
      'Normalization reduces update anomalies. First, second, and third normal forms progressively remove repeating groups and partial or transitive dependencies.',
      'SQL essentials: SELECT columns FROM table, filter with WHERE, combine tables with JOIN, and summarize with GROUP BY and aggregate functions.',
      'Transactions group changes into one unit. ACID means atomicity, consistency, isolation, and durability.'
    ]
  },
  {
    keywords: ['operating system', 'os '],
    sections: [
      'A process is a running program with its own execution state; threads share process resources while executing independently.',
      'CPU scheduling allocates processor time. Common strategies include first-come-first-served, shortest-job-first, priority, and round-robin scheduling.',
      'Synchronization protects shared state. Mutexes and semaphores coordinate access and help prevent race conditions.',
      'Deadlock requires mutual exclusion, hold-and-wait, no preemption, and circular wait. Prevention breaks at least one condition.',
      'Memory management includes paging, virtual memory, page replacement, and protection between processes.'
    ]
  },
  {
    keywords: ['network', 'computer networks'],
    sections: [
      'Layered models separate networking responsibilities. TCP/IP commonly describes link, internet, transport, and application layers.',
      'IP provides addressing and routing. Routers forward packets between networks using routing tables.',
      'TCP provides ordered, reliable byte streams; UDP provides lightweight datagrams without delivery guarantees.',
      'DNS maps domain names to records. HTTP defines request-response communication for web applications.',
      'Network troubleshooting should verify link, address configuration, name resolution, routing, and application service in order.'
    ]
  },
  {
    keywords: ['compiler'],
    sections: [
      'A compiler transforms source code into a target representation while checking that the program follows language rules.',
      'Typical phases are lexical analysis, parsing, semantic analysis, intermediate representation, optimization, and code generation.',
      'A lexer groups characters into tokens. A parser checks token structure against a grammar and builds a syntax tree.',
      'Semantic checks validate types, declarations, scopes, and operations that are syntactically valid but potentially meaningless.',
      'Optimizations should preserve program behavior; examples include constant folding, dead-code elimination, and common-subexpression elimination.'
    ]
  },
  {
    keywords: ['cybersecurity', 'security', 'upload'],
    sections: [
      'Threat modeling identifies assets, trust boundaries, likely attackers, and abuse cases before selecting mitigations.',
      'Use least privilege: grant each user and process only the permissions needed for its task.',
      'For uploads, validate file size and allowed formats, generate server-side filenames, store files outside public paths, and verify authorization on every download.',
      'Treat filenames and metadata as untrusted input. Resolve paths against a fixed storage root and reject paths that escape that root.',
      'Log security-relevant actions without recording passwords, tokens, or sensitive document contents.'
    ]
  },
  {
    keywords: ['mathematics', 'math'],
    sections: [
      'Calculus studies change and accumulation. Derivatives describe local rates of change; definite integrals describe accumulated quantities.',
      'Linear algebra represents systems with vectors and matrices. Matrix operations support solving linear systems and coordinate transformations.',
      'Probability quantifies uncertainty. Conditional probability updates an event likelihood given observed information.',
      'When solving a problem, state assumptions, define variables, show intermediate steps, and check units and boundary cases.',
      'Numerical approximations should be checked for rounding error and compared with known constraints or limiting cases.'
    ]
  }
];

const genericSections = [
  'Start with the learning objectives and identify the concepts, definitions, and methods required for the topic.',
  'Organize the material into a sequence: prerequisite ideas, core principles, worked examples, and practice questions.',
  'For each method, record its assumptions, steps, expected output, and common failure cases.',
  'Check understanding by solving a new example without looking at the worked solution, then explain why each step is valid.',
  'Use this original sample handout as a study aid and verify course-specific requirements with your instructor.'
];

const questionBankSections = [
  'Explain the central concepts and terminology used in this subject. Give one relevant example.',
  'Compare two commonly used methods or approaches and identify when each is appropriate.',
  'Apply a suitable method to a small example. Show the assumptions and intermediate steps.',
  'Analyze a failure case or limitation and explain how it can be detected or mitigated.',
  'Answer guide: define terms precisely, justify each step, and state any assumptions.'
];

const samplePaperSections = [
  'Answer any five questions. Each question carries 10 marks.',
  '1. Define the key terms for this subject and explain how they relate to one another.',
  '2. Work through a representative problem, stating assumptions and showing intermediate steps.',
  '3. Compare two methods from the course and discuss their trade-offs.',
  '4. Analyze a practical scenario and recommend an approach with justification.',
  '5. Identify a likely failure case and explain how it can be detected or prevented.',
  '6. Summarize one core principle and support your explanation with a relevant example.',
  'Sample paper only. Marks and questions are illustrative, not an official examination.'
];

const cleanPdfText = (value) => String(value)
  .normalize('NFKD')
  .replace(/[^\x20-\x7E]/g, ' ')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const wrapText = (value, width = 88) => {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }

  if (line) lines.push(line);
  return lines;
};

const createPdf = (resource) => {
  const subject = resource.subject || '';
  const matchingContent = subjectContent.find(({ keywords }) =>
    keywords.some(keyword => subject.toLowerCase().includes(keyword))
  );
  const sections = resource.category === 'QUESTION_BANK'
    ? questionBankSections
    : resource.category === 'PREVIOUS_PAPER'
      ? samplePaperSections
      : matchingContent
        ? matchingContent.sections
        : genericSections;
  const contentLines = [
    resource.title,
    `Subject: ${subject} | Semester: ${resource.semester} | Academic year: ${resource.academicYear}`,
    resource.category === 'PREVIOUS_PAPER' ? 'Duration: 2 hours | Maximum marks: 50' : '',
    resource.unit ? `Unit: ${resource.unit}` : '',
    '',
    'Original CampusHub sample learning handout',
    '',
    ...sections.flatMap((section, index) => [
      `${index + 1}. ${section}`,
      ''
    ]),
    'This is a demonstration study aid, not an official institutional document.'
  ].filter(line => line !== undefined);
  const lines = contentLines.flatMap(line => line ? wrapText(line) : ['']);
  const commands = ['BT', '/F1 10 Tf', '50 760 Td'];

  lines.slice(0, 42).forEach((line, index) => {
    if (index > 0) commands.push('0 -16 Td');
    commands.push(`(${cleanPdfText(line)}) Tj`);
  });
  commands.push('ET');

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'ascii');
};

const isUsableResourceFile = (filePath, fileName) => {
  if (typeof filePath !== 'string') return false;

  const normalizedPath = filePath.replace(/\\/g, '/');
  if (!normalizedPath.startsWith('uploads/academic-resources/')) return false;

  const resourceBase = path.resolve(__dirname, '../uploads/academic-resources');
  const absolutePath = path.resolve(__dirname, '..', normalizedPath);
  const relativePath = path.relative(resourceBase, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return false;
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return false;

  const extension = path.extname(fileName || '').toLowerCase();
  const signatures = {
    '.pdf': { bytes: Buffer.from('%PDF-'), offset: 0 },
    '.doc': { bytes: Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), offset: 0 },
    '.docx': { bytes: Buffer.from([0x50, 0x4B, 0x03, 0x04]), offset: 0 },
    '.ppt': { bytes: Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), offset: 0 },
    '.pptx': { bytes: Buffer.from([0x50, 0x4B, 0x03, 0x04]), offset: 0 },
    '.png': { bytes: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), offset: 0 },
    '.jpg': { bytes: Buffer.from([0xFF, 0xD8, 0xFF]), offset: 0 },
    '.jpeg': { bytes: Buffer.from([0xFF, 0xD8, 0xFF]), offset: 0 }
  };
  const signature = signatures[extension];
  if (!signature) return false;

  const header = Buffer.alloc(extension === '.pdf' ? 1024 : signature.bytes.length);
  const descriptor = fs.openSync(absolutePath, 'r');
  try {
    const bytesRead = fs.readSync(descriptor, header, 0, header.length, signature.offset);
    if (bytesRead < signature.bytes.length || !header.subarray(0, signature.bytes.length).equals(signature.bytes)) {
      return false;
    }

    return extension !== '.pdf'
      || !header.subarray(0, bytesRead).toString('latin1').includes('(CampusHub Document)');
  } finally {
    fs.closeSync(descriptor);
  }
};

const createResourceFileName = (title, id) => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 55) || 'academic-resource';
  return `${slug}-${id}.pdf`;
};

async function repairAcademicResources() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campushub');
  const resources = await AcademicResource.find();
  let repairedCount = 0;

  for (const resource of resources) {
    const replacement = demoRecordReplacements[resource.title];
    if (replacement) {
      resource.title = replacement.title;
      resource.subject = replacement.subject;
    }

    if (replacement || !isUsableResourceFile(resource.filePath, resource.fileName)) {
      const category = categoryDirectories[resource.category] ? resource.category : 'NOTES';
      const fileName = createResourceFileName(resource.title, resource._id.toString());
      const filePath = path.join(
        __dirname,
        `../uploads/academic-resources/${categoryDirectories[category]}`,
        fileName
      );
      const fileBuffer = createPdf(resource);

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, fileBuffer);
      resource.fileName = fileName;
      resource.filePath = `uploads/academic-resources/${categoryDirectories[category]}/${fileName}`;
      resource.fileType = 'application/pdf';
      resource.fileSize = fileBuffer.length;
      await resource.save();
      repairedCount++;
    }
  }

  console.log(`Verified ${resources.length} academic resources; repaired ${repairedCount}.`);
}

repairAcademicResources()
  .catch(error => {
    console.error('Academic resource repair failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
