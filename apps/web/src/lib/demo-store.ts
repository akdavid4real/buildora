import type { DemoStoreState } from './types';

const STORAGE_KEY = 'buildora_demo_store_v2';

export const INITIAL_DEMO_STATE: DemoStoreState = {
  version: 2,
  site: {
    siteName: 'My Business Site',
    siteSlug: 'my-business-site',
    tagline: 'Building a better web, together.',
    themeId: 'small-business',
    accentColor: '#164e3f',
    customDomain: 'demo.buildora.dev',
    seoTitle: 'My Business Site | Powered by Buildora',
    seoDescription:
      'Professional web creation made simple, fast, and accessible for everyone, powered by AI.',
  },
  pages: [
    {
      id: 'page-home',
      title: 'Home',
      slug: '',
      isHomepage: true,
      status: 'PUBLISHED',
      content: `<h1>Empower Your Business With Next-Gen Web Design</h1><p>Welcome to Buildora! We build fast, reliable, modern digital experiences that turn visitors into loyal customers. Explore our services and discover how easy digital transformation can be.</p><h2>Why Choose Us?</h2><ul><li>Instant AI-assisted content optimization</li><li>Lightning fast load speeds with modern web architecture</li><li>Responsive on all devices out of the box</li><li>Intuitive content management without the technical headaches</li></ul><p>Ready to level up your online presence? Get started today or explore our services below.</p>`,
      seoTitle: 'Home | My Business Site',
      seoDescription:
        'Empower your business with next-gen web design and fast digital experiences.',
      updatedAt: '2026-09-09T14:30:00Z',
    },
    {
      id: 'page-about',
      title: 'About Us',
      slug: 'about',
      isHomepage: false,
      status: 'PUBLISHED',
      content: `<h1>Building a better web, together.</h1><p>At Buildora, we believe every business deserves a beautiful, high-performing website — without the complexity. Our mission is to make professional web creation simple, fast, and accessible for everyone, powered by AI.</p><p>We're a small, passionate team of builders, designers, and problem-solvers who care about the web and the people who use it. Whether you're launching a new idea or growing an established brand, we're here to help you bring your vision to life.</p><h2>Our values</h2><ul><li>Simplicity over complexity</li><li>Real tools for real people</li><li>Continuous improvement</li><li>A more open and creative web</li></ul><p>Thanks for being part of the Buildora journey.</p>`,
      seoTitle: 'About Us | Building a better web',
      seoDescription: 'Learn about our mission, our team, and our values at Buildora.',
      updatedAt: '2026-09-09T14:28:00Z',
    },
    {
      id: 'page-services',
      title: 'Services',
      slug: 'services',
      isHomepage: false,
      status: 'PUBLISHED',
      content: `<h1>Comprehensive Digital Solutions</h1><p>We deliver tailored web design, AI integration, and digital growth services crafted to scale with your organization.</p><h2>Our Core Offerings</h2><ul><li><strong>Custom Web Development:</strong> Fast, accessible, and responsive sites built to convert.</li><li><strong>AI Content Strategy:</strong> Streamlined copy generation and dynamic SEO metadata.</li><li><strong>Performance Optimization:</strong> Top-tier Core Web Vitals and lightning fast loading.</li></ul>`,
      seoTitle: 'Our Services | Custom Web Development & AI Solutions',
      seoDescription: 'Explore our range of web development, AI integration, and digital services.',
      updatedAt: '2026-09-09T12:00:00Z',
    },
    {
      id: 'page-portfolio',
      title: 'Portfolio',
      slug: 'portfolio',
      isHomepage: false,
      status: 'PUBLISHED',
      content: `<h1>Featured Work & Case Studies</h1><p>Take a look at recent client projects and success stories built with our design system and CMS engine.</p><h2>Recent Highlights</h2><ul><li><strong>Apex Global:</strong> 120% increase in lead generation within 60 days.</li><li><strong>Studio Lumen:</strong> High-impact portfolio architecture for award-winning creatives.</li><li><strong>Horizon Labs:</strong> Interactive knowledge base and lightning fast blog.</li></ul>`,
      seoTitle: 'Portfolio | Selected Works & Case Studies',
      seoDescription: 'Case studies and client success stories created with modern web standards.',
      updatedAt: '2026-09-08T18:00:00Z',
    },
    {
      id: 'page-blog',
      title: 'Blog',
      slug: 'blog',
      isHomepage: false,
      status: 'PUBLISHED',
      content: `<h1>Insights, News & Tutorials</h1><p>Read our latest articles on web performance, AI tooling, and design systems for modern digital teams.</p>`,
      seoTitle: 'Blog | Insights, News & Tutorials',
      seoDescription: 'Articles on web performance, AI workflows, and modern web design.',
      updatedAt: '2026-09-08T15:30:00Z',
    },
    {
      id: 'page-contact',
      title: 'Contact',
      slug: 'contact',
      isHomepage: false,
      status: 'DRAFT',
      content: `<h1>Get in touch with our team</h1><p>Have a question or looking to start a new project? Reach out to us directly through the contact form or drop us an email.</p><p>Email: <strong>hello@buildora.dev</strong><br/>Phone: <strong>+1 (555) 019-2834</strong></p>`,
      seoTitle: 'Contact Us | Let us build together',
      seoDescription: 'Get in touch with our team for questions, partnerships, and projects.',
      updatedAt: '2026-09-07T09:15:00Z',
    },
  ],
  posts: [
    {
      id: 'post-1',
      title: 'Launching Buildora: The Next-Gen AI CMS',
      slug: 'launching-buildora',
      excerpt:
        'Today we are proud to introduce Buildora, a lightweight AI-powered CMS designed for fast brochure sites and modern blogs.',
      coverImageUrl:
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=60',
      status: 'PUBLISHED',
      authorName: 'John Doe',
      tags: ['Product', 'AI', 'Launch'],
      publishedAt: '2026-09-01T10:00:00Z',
      content: `<h1>Launching Buildora: The Next-Gen AI CMS</h1><p>Today marks an exciting milestone. We are officially unveiling Buildora, an AI-first content management platform designed specifically for lightweight brochure websites, portfolio pages, and modern blogs.</p><p>Traditional CMS platforms have become bloated with complex plugins, fragile upgrade cycles, and confusing user interfaces. Buildora changes that by combining instantaneous Bun-powered APIs with real-time AI writing assistance and clean, deterministic theme rendering.</p><h2>Key Features</h2><ul><li>AI-assisted copywriting, title generation, and SEO suggestions</li><li>Deterministic theme system with zero plugin fatigue</li><li>Built-in raster media safety and responsive previews</li><li>Lightning-fast static page generation and sub-second updates</li></ul><p>We are just getting started. Try building your first page today!</p>`,
      updatedAt: '2026-09-09T11:00:00Z',
    },
    {
      id: 'post-2',
      title: '10 Design Rules for High-Converting Landing Pages',
      slug: '10-design-rules',
      excerpt:
        'Practical visual hierarchy tips to turn casual website visitors into loyal customers.',
      coverImageUrl:
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
      status: 'PUBLISHED',
      authorName: 'Sarah Jenkins',
      tags: ['Design', 'Conversion', 'UX'],
      publishedAt: '2026-09-05T14:30:00Z',
      content: `<h1>10 Design Rules for High-Converting Landing Pages</h1><p>Creating a high-converting website is both an art and an engineering discipline. Here are the core principles our design team uses on every project.</p><h2>1. Focus on One Clear Call to Action</h2><p>Never confuse your visitors with competing buttons. Guide them smoothly toward the primary action you want them to take.</p><h2>2. Keep Typography Legible and Hierarchical</h2><p>Use high contrast text, generous line heights, and clear heading sizes to make scanning effortless.</p><h2>3. Deliver Sub-Second Page Speeds</h2><p>Every 100ms delay in page load drops conversion by up to 7%. Fast sites win every time.</p>`,
      updatedAt: '2026-09-08T16:20:00Z',
    },
    {
      id: 'post-3',
      title: 'Why Fast, Static-First Architectures Win in 2026',
      slug: 'fast-static-architectures',
      excerpt:
        'How modern edge caching and lightweight runtimes make traditional databases obsolete for brochure sites.',
      coverImageUrl:
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=60',
      status: 'DRAFT',
      authorName: 'Alex Rivera',
      tags: ['Architecture', 'Performance'],
      publishedAt: null,
      content: `<h1>Why Fast, Static-First Architectures Win in 2026</h1><p>For standard corporate websites and marketing blogs, complex database-heavy architectures create unnecessary vulnerability surface areas and high latency. Static-first architecture solves this by pre-compiling pages while retaining instant editing capabilities.</p>`,
      updatedAt: '2026-09-07T10:00:00Z',
    },
  ],
  media: [
    {
      id: 'media-1',
      name: 'modern-workspace.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 245000,
      url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=60',
      createdAt: '2026-09-01T09:00:00Z',
    },
    {
      id: 'media-2',
      name: 'analytics-dashboard.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 198000,
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
      createdAt: '2026-09-02T10:30:00Z',
    },
    {
      id: 'media-3',
      name: 'code-editor-dark.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 312000,
      url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=60',
      createdAt: '2026-09-03T14:15:00Z',
    },
    {
      id: 'media-4',
      name: 'team-collaboration.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 420000,
      url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=60',
      createdAt: '2026-09-04T16:45:00Z',
    },
  ],
  selectedPageId: 'page-about',
  selectedPostId: 'post-1',
  activeNav: 'pages',
};

export class DemoStore {
  private static isClient(): boolean {
    return typeof window !== 'undefined';
  }

  static getState(): DemoStoreState {
    if (!this.isClient()) {
      return INITIAL_DEMO_STATE;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        this.saveState(INITIAL_DEMO_STATE);
        return INITIAL_DEMO_STATE;
      }
      const parsed = JSON.parse(stored) as DemoStoreState;
      if (parsed.version !== INITIAL_DEMO_STATE.version) {
        this.saveState(INITIAL_DEMO_STATE);
        return INITIAL_DEMO_STATE;
      }
      return parsed;
    } catch {
      return INITIAL_DEMO_STATE;
    }
  }

  static saveState(state: DemoStoreState): void {
    if (this.isClient()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }

  static resetToDefault(): DemoStoreState {
    this.saveState(INITIAL_DEMO_STATE);
    return INITIAL_DEMO_STATE;
  }
}
