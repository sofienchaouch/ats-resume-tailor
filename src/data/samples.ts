import { ResumeData } from '../types';

export interface SampleResume {
  id: string;
  name: string;
  language: 'en' | 'fr';
  role: string;
  data: ResumeData;
}

export const sampleResumes: SampleResume[] = [
  {
    id: 'en-software-dev',
    name: 'English - General Software Engineer',
    language: 'en',
    role: 'Software Engineer',
    data: {
      contact: {
        name: 'Alex Mercer',
        title: 'Full Stack Software Engineer',
        email: 'alex.mercer@email.com',
        phone: '+1 (555) 019-2834',
        location: 'New York, NY',
        linkedin: 'linkedin.com/in/alex-mercer',
        website: 'alexmercer.dev'
      },
      summary: 'Experienced software engineer with 4+ years of background building web applications. Skilled in multiple programming languages and frontend/backend tech stacks. Passionate about writing clean code, fixing bugs, and cooperating with cross-functional teams to deliver solid customer products.',
      experience: [
        {
          company: 'CloudScale Technologies',
          role: 'Software Engineer II',
          location: 'New York, NY',
          startDate: '2024-01',
          endDate: 'Present',
          bullets: [
            'Worked on high-traffic React and Node.js applications, improving interface responsiveness and backend speed.',
            'Assisted in migrating legacy codebase to modern TypeScript and styled components, reducing tech debt.',
            'Collaborated with product owners, designers, and QA engineers to plan, build, and test monthly feature releases.',
            'Built custom API integrations with external cloud databases and third-party dashboard portals.',
            'Participated in daily standups, sprint reviews, and pair programming sessions to ensure team code quality.'
          ]
        },
        {
          company: 'InnoTech Solutions',
          role: 'Junior Web Developer',
          location: 'Boston, MA',
          startDate: '2022-05',
          endDate: '2023-12',
          bullets: [
            'Designed and launched landing pages and interactive dashboards for B2B e-commerce platform clients.',
            'Wrote comprehensive unit and integration tests using Jest, achieving a 15% increase in total code coverage.',
            'Optimized SQL database query structures to lower response times for heavy user search operations.',
            'Identified and patched 40+ security vulnerabilities and layout errors reported in the client Jira boards.'
          ]
        }
      ],
      skills: [
        {
          category: 'Programming Languages',
          items: ['JavaScript', 'TypeScript', 'HTML5', 'CSS3', 'Python', 'SQL']
        },
        {
          category: 'Frameworks & Libraries',
          items: ['React', 'Next.js', 'Node.js', 'Express', 'TailwindCSS', 'Redux Toolkit']
        },
        {
          category: 'Tools & DevOps',
          items: ['Git', 'GitHub', 'Docker', 'AWS S3', 'PostgreSQL', 'MongoDB', 'Postman']
        }
      ],
      education: [
        {
          institution: 'State University of New York',
          degree: 'Bachelor of Science in Computer Science',
          location: 'Albany, NY',
          graduationDate: '2022-05',
          gpa: '3.6/4.0'
        }
      ],
      certifications: [
        {
          name: 'AWS Certified Cloud Practitioner',
          issuer: 'Amazon Web Services',
          date: '2023-08'
        }
      ],
      projects: [
        {
          name: 'TaskFlow Planner',
          description: 'A customizable drag-and-drop kanban board for team collaborations featuring instant notifications.',
          technologies: ['React', 'Node.js', 'Socket.io', 'MongoDB'],
          link: 'github.com/alexm/taskflow'
        }
      ],
      languages: ['English (Native)', 'Spanish (Conversational)']
    }
  },
  {
    id: 'fr-software-dev',
    name: 'Français - Ingénieur Logiciel Généraliste',
    language: 'fr',
    role: 'Ingénieur Logiciel',
    data: {
      contact: {
        name: 'Marie Dubois',
        title: 'Développeuse Full Stack',
        email: 'marie.dubois@email.com',
        phone: '+33 6 12 34 56 78',
        location: 'Paris, France',
        linkedin: 'linkedin.com/in/marie-dubois',
        website: 'mariedubois.fr'
      },
      summary: 'Ingénieure logiciel expérimentée avec plus de 4 ans d\'expérience dans la création d\'applications web. Compétente dans plusieurs langages de programmation et technologies frontend/backend. Passionnée par l\'écriture d\'un code propre, la résolution de bugs complexes et la collaboration avec les équipes produit.',
      experience: [
        {
          company: 'Noveo Technologies',
          role: 'Développeuse Web Senior',
          location: 'Paris, France',
          startDate: '2024-02',
          endDate: 'Présent',
          bullets: [
            'Développement d\'applications réactives à fort trafic en React et Node.js, améliorant la vitesse de chargement de 30%.',
            'Migration d\'une base de code héritée vers TypeScript et des architectures de composants modernes.',
            'Coopération active avec les chefs de produit et designers pour concevoir des fonctionnalités interactives.',
            'Mise en place d\'intégrations API avec des bases de données cloud de premier plan et des plateformes SaaS tierces.',
            'Animation de revues de code hebdomadaires et mentorat de deux développeurs juniors.'
          ]
        },
        {
          company: 'Synergie Solution',
          role: 'Développeuse Full Stack Junior',
          location: 'Lyon, France',
          startDate: '2022-09',
          endDate: '2024-01',
          bullets: [
            'Conception et déploiement de tableaux de bord transactionnels pour des clients e-commerce nationaux.',
            'Écriture de tests d\'intégration robustes avec Jest, augmentant la couverture de test globale de 20%.',
            'Optimisation des requêtes de base de données PostgreSQL pour réduire le temps de chargement des rapports.',
            'Correction d\'anomalies graphiques complexes et assurance de la compatibilité responsive sur mobile.'
          ]
        }
      ],
      skills: [
        {
          category: 'Langages',
          items: ['JavaScript', 'TypeScript', 'HTML/CSS', 'Python', 'SQL']
        },
        {
          category: 'Frameworks',
          items: ['React', 'Next.js', 'Node.js', 'Express', 'Tailwind CSS', 'Redux']
        },
        {
          category: 'Outils & Bases de données',
          items: ['Git', 'Docker', 'PostgreSQL', 'MongoDB', 'AWS', 'REST APIs']
        }
      ],
      education: [
        {
          institution: 'Université de Technologie de Compiègne',
          degree: 'Master en Ingénierie Informatique',
          location: 'Compiègne, France',
          graduationDate: '2022-07'
        }
      ],
      certifications: [
        {
          name: 'Certification Scrum Master',
          issuer: 'Scrum Alliance',
          date: '2023-11'
        }
      ],
      projects: [
        {
          name: 'EcoDrive',
          description: 'Calculateur d\'empreinte carbone en temps réel pour flottes de véhicules d\'entreprise.',
          technologies: ['React', 'Express', 'PostgreSQL', 'Chart.js']
        }
      ],
      languages: ['Français (Maternelle)', 'Anglais (Professionnel)']
    }
  },
  {
    id: 'en-product-mgr',
    name: 'English - General Product Manager',
    language: 'en',
    role: 'Product Manager',
    data: {
      contact: {
        name: 'Jordan Taylor',
        title: 'Product Manager',
        email: 'jordan.taylor@email.com',
        phone: '+1 (555) 045-6789',
        location: 'San Francisco, CA',
        linkedin: 'linkedin.com/in/jordan-taylor',
        website: 'jordantaylor.pm'
      },
      summary: 'Results-driven Product Manager with over 3 years of experience overseeing software product life cycles. Experienced in collecting customer feedback, translating insights into clear requirements, prioritizing roadmaps, and coordinating with engineering teams to launch business-critical web features.',
      experience: [
        {
          company: 'AppVantage Software',
          role: 'Associate Product Manager',
          location: 'San Francisco, CA',
          startDate: '2023-04',
          endDate: 'Present',
          bullets: [
            'Managed product backlog and owned the sprint planning cycle for an enterprise task-management product suite.',
            'Wrote detailed product requirement documents (PRDs) and user stories, decreasing development cycle delays by 10%.',
            'Analyzed weekly user engagement metrics via Mixpanel, identifying drop-off points and recommending flow adjustments.',
            'Partnered with customer success teams to resolve enterprise client complaints and prioritize bug fixes.',
            'Successfully launched a new self-serve billing module, increasing conversion rates on trial tiers by 12%.'
          ]
        },
        {
          company: 'Spark Startup',
          role: 'Operations & Product Coordinator',
          location: 'San Francisco, CA',
          startDate: '2022-01',
          endDate: '2023-03',
          bullets: [
            'Collected and synthesized qualitative feedback from 200+ beta testers using surveys and focus groups.',
            'Created wireframes and low-fidelity prototypes for mobile-responsive screens using Figma.',
            'Coordinated beta testing program schedules, ensuring timely bug logs were filed with engineering.'
          ]
        }
      ],
      skills: [
        {
          category: 'Product Management',
          items: ['Agile/Scrum', 'Backlog Prioritization', 'PRD Writing', 'User Research', 'Product Roadmapping']
        },
        {
          category: 'Analytics & Tools',
          items: ['Mixpanel', 'Google Analytics', 'Jira', 'Confluence', 'Figma', 'Trello', 'Excel']
        },
        {
          category: 'Technical Familiarity',
          items: ['HTML/CSS', 'SQL Basics', 'API integration concept', 'SaaS Architecture']
        }
      ],
      education: [
        {
          institution: 'University of California, Berkeley',
          degree: 'Bachelor of Science in Business Administration',
          location: 'Berkeley, CA',
          graduationDate: '2021-12'
        }
      ],
      projects: [
        {
          name: 'FeedbackHub Integration',
          description: 'A custom feedback consolidation panel that feeds directly into team Jira tickets.',
          technologies: ['Figma', 'Jira API', 'Zapier']
        }
      ],
      languages: ['English (Native)', 'French (Intermediate)']
    }
  }
];
