import { Link } from "wouter";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { CATEGORIES } from "@/services/productService";
import { useAuth } from "@/contexts/AuthContext";

const categoryDetails: Record<
  string,
  { icon: string; description: string; tint: string }
> = {
  Fruits: {
    icon: "🍎",
    description: "Naturally sweet, farm-fresh picks",
    tint: "from-lime-50 to-emerald-50",
  },
  Vegetables: {
    icon: "🥬",
    description: "Fresh greens for every table",
    tint: "from-emerald-50 to-green-100",
  },
};

const benefits = [
  {
    icon: "🌱",
    title: "Grown with care",
    description:
      "Discover seasonal produce from local growers who care about every harvest.",
  },
  {
    icon: "🚚",
    title: "From farm to door",
    description:
      "Follow your order from checkout through delivery with clear updates.",
  },
  {
    icon: "🤝",
    title: "Support local farms",
    description:
      "Every purchase helps Filipino farming communities grow and thrive.",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="overflow-hidden">
      <section className="relative isolate overflow-hidden bg-emerald-950 text-white">
        <img
          src="/images/havestra-farm-hero.webp"
          alt=""
          aria-hidden="true"
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-950/95 via-emerald-950/75 to-emerald-950/35"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_35%,rgba(190,242,100,0.2),transparent_38%)]"
        />

        <div className="container relative grid min-h-[600px] items-center gap-12 py-16 sm:py-20 lg:min-h-[680px] lg:grid-cols-[1.2fr_0.8fr] lg:gap-16 lg:py-24">
          <div className="route-enter max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-sm backdrop-blur-sm">
              <BrandMark className="h-4 w-4" />
              Good food begins close to home
            </div>
            <h1 className="max-w-[24ch] text-[clamp(2.7rem,5vw,4.6rem)] font-bold leading-[1.02] tracking-[-0.055em] text-white">
              Fresh from the Farm,
              <span className="mt-2 block text-lime-200">
                Straight to Your Home.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-emerald-50/90 sm:text-lg sm:leading-8">
              Havestra brings local farmers and customers closer, making it
              easier to discover fresh harvests and support the people who grow
              them.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={isAuthenticated ? "/products" : "/login"}
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#fffdf5] px-7 py-3.5 font-semibold text-emerald-900 shadow-lg shadow-emerald-950/25 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200"
              >
                Explore Products
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                />
              </Link>
              <a
                href="#shop-by-category"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 bg-white/10 px-6 py-3.5 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                Browse categories
                <ChevronDown size={16} />
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-emerald-50/90">
              <span className="inline-flex items-center gap-2">
                <span className="text-lime-200">✓</span> Local growers
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-lime-200">✓</span> Fresh harvests
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-lime-200">✓</span> Easy order tracking
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:justify-self-end">
            <div
              aria-hidden="true"
              className="hero-glow pointer-events-none absolute -inset-8 rounded-full bg-lime-300/20 blur-3xl"
            />
            <div className="relative rounded-[2rem] border border-white/25 bg-emerald-950/35 p-7 shadow-2xl shadow-emerald-950/20 backdrop-blur-md sm:p-9">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-200 text-emerald-900 shadow-lg shadow-emerald-950/15">
                <BrandMark className="h-8 w-8" />
              </div>
              <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-lime-200">
                Growing close to home
              </p>
              <h2 className="mt-3 text-2xl font-bold leading-snug text-white sm:text-3xl">
                Fresh picks.
                <span className="block text-emerald-100">
                  Stronger communities.
                </span>
              </h2>
              <p className="mt-4 text-sm leading-6 text-emerald-50/90 sm:text-base">
                Meet local growers and discover the care behind every harvest.
              </p>
              <div className="mt-7 flex items-center gap-3 border-t border-white/20 pt-5">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-lime-200"
                >
                  <BrandMark className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-white">
                  Rooted in local farms
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="shop-by-category"
        className="scroll-mt-24 bg-white py-16 sm:py-20"
      >
        <div className="container">
          <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
                The Havestra market
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                A little closer to the farm
              </h2>
              <p className="mt-3 max-w-2xl text-slate-600">
                Browse produce selected for freshness and sourced from trusted
                local growers.
              </p>
            </div>
            <Link
              href={isAuthenticated ? "/products" : "/login"}
              className="inline-flex items-center gap-2 font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
            >
              View all products <ChevronRight size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {CATEGORIES.map(category => {
              const details = categoryDetails[category] ?? {
                icon: "🌿",
                description: "Explore fresh picks from local growers",
                tint: "from-emerald-50 to-green-100",
              };
              return (
                <Link
                  key={category}
                  href={`/products?category=${encodeURIComponent(category)}`}
                  className={`interactive-card group relative flex min-h-44 items-center justify-between overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br ${details.tint} p-4 pt-14 sm:min-h-56 sm:p-8`}
                >
                  <div className="relative z-10 min-w-0">
                    <p className="text-xs font-semibold text-emerald-800 sm:text-sm">
                      Explore the harvest
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-slate-900 md:text-3xl">
                      {category}
                    </h3>
                    <p className="mt-2 max-w-[9rem] text-xs text-slate-600 sm:max-w-[15rem] sm:text-sm">
                      {details.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 sm:mt-5 sm:text-base">
                      Shop now
                      <ArrowRight
                        size={16}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </span>
                  </div>
                  <span
                    aria-hidden="true"
                    className="hero-float absolute right-3 top-2 z-10 text-3xl drop-shadow-sm sm:relative sm:right-auto sm:top-auto sm:text-8xl"
                  >
                    {details.icon}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full border-[24px] border-white/35"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="benefits"
        className="scroll-mt-24 bg-gradient-to-br from-lime-50 via-emerald-50/80 to-[#fbfaf4] py-16 sm:py-20"
      >
        <div className="container">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              From our fields to your home
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Good things grow together
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            {benefits.map((benefit, index) => (
              <article
                key={benefit.title}
                className="interactive-card rounded-[1.75rem] border border-emerald-100 bg-white p-4 shadow-sm sm:p-7"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                  {benefit.icon}
                </div>
                <h3 className="mt-5 text-base font-bold text-slate-900 sm:text-lg">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {benefit.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
