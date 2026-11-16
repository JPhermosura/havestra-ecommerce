import { Link } from "wouter";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
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
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-white via-emerald-50/70 to-green-100/70">
        <div
          aria-hidden="true"
          className="hero-glow pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-300/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 left-1/4 h-96 w-96 rounded-full bg-lime-200/50 blur-3xl"
        />

        <div className="container relative grid min-h-[560px] items-center gap-10 py-14 sm:py-20 lg:min-h-[650px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
          <div className="route-enter max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm">
              <span aria-hidden="true">✦</span>
              Good food begins close to home
            </div>
            <h1 className="max-w-[13ch] text-[clamp(2.65rem,7vw,5.25rem)] font-bold leading-[1.03] tracking-[-0.055em] text-emerald-950">
              Grow your farm.
              <span className="mt-2 block bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">
                Thrive together.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Shop fresh fruits and vegetables from local farms, and bring the
              best of every harvest to your table.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={isAuthenticated ? "/products" : "/register"}
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-700 px-7 py-3.5 font-semibold text-white shadow-lg shadow-emerald-900/15 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-xl focus-visible:outline-emerald-700"
              >
                {isAuthenticated ? "Explore the market" : "Join Havestra"}
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
              <a
                href="#shop-by-category"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-6 py-3.5 font-semibold text-emerald-900 transition-colors hover:bg-white"
              >
                Explore categories
                <ChevronDown size={16} />
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
              <span className="inline-flex items-center gap-2">
                <span className="text-emerald-600">✓</span> Local growers
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-emerald-600">✓</span> Fresh harvests
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-emerald-600">✓</span> Easy order tracking
              </span>
            </div>
          </div>

          <div className="hero-float relative mx-auto flex aspect-[1.05] w-full max-w-[500px] items-center justify-center">
            <div
              aria-hidden="true"
              className="absolute inset-[8%] rounded-[3rem] bg-gradient-to-br from-emerald-200 via-green-100 to-lime-100 shadow-inner shadow-white/80"
            />
            <div className="absolute inset-[15%] rotate-[-7deg] rounded-[2.5rem] border border-white/80 bg-white/35 shadow-2xl shadow-emerald-950/10 backdrop-blur-sm" />
            <div className="relative z-10 flex h-[68%] w-[68%] flex-col items-center justify-center rounded-[2.5rem] border border-white/80 bg-gradient-to-br from-emerald-600 to-green-800 text-center text-white shadow-2xl shadow-emerald-950/25">
              <span
                className="text-7xl drop-shadow sm:text-8xl"
                aria-hidden="true"
              >
                🌾
              </span>
              <p className="mt-4 max-w-[12rem] text-lg font-bold leading-snug sm:text-xl">
                Better harvests, shared
              </p>
              <span className="mt-3 rounded-full bg-white/15 px-3 py-1 text-xs font-medium tracking-wide text-emerald-50">
                FARM • FRESH • LOCAL
              </span>
            </div>
            <div className="absolute left-0 top-[22%] z-20 rounded-2xl border border-white bg-white/95 px-4 py-3 shadow-xl shadow-emerald-950/10">
              <span className="block text-xs font-medium text-slate-500">
                Rooted in community
              </span>
              <span className="mt-1 block font-bold text-emerald-800">
                🌿 Growing together
              </span>
            </div>
            <div className="absolute bottom-[16%] right-0 z-20 rounded-2xl border border-white bg-white/95 px-4 py-3 shadow-xl shadow-emerald-950/10">
              <span className="block text-xs font-medium text-slate-500">
                Every season
              </span>
              <span className="mt-1 block font-bold text-emerald-800">
                Fresh from the farm ✨
              </span>
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

          <div className="grid gap-4 sm:grid-cols-2">
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
                  className={`interactive-card group relative flex min-h-44 items-center justify-between overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br ${details.tint} p-6 sm:min-h-56 sm:p-8`}
                >
                  <div className="relative z-10">
                    <p className="text-sm font-semibold text-emerald-800">
                      Explore the harvest
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                      {category}
                    </h3>
                    <p className="mt-2 max-w-[15rem] text-sm text-slate-600">
                      {details.description}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1 font-semibold text-emerald-800">
                      Shop now
                      <ArrowRight
                        size={16}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </span>
                  </div>
                  <span
                    aria-hidden="true"
                    className="hero-float relative z-10 text-6xl drop-shadow-sm sm:text-8xl"
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
        className="scroll-mt-24 bg-emerald-50/70 py-16 sm:py-20"
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
          <div className="grid gap-4 md:grid-cols-3">
            {benefits.map((benefit, index) => (
              <article
                key={benefit.title}
                className="interactive-card rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm sm:p-7"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                  {benefit.icon}
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">
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
