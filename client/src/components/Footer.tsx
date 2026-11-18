import { Link } from "wouter";
import BrandMark from "@/components/BrandMark";

const linkClass =
  "transition-colors duration-200 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-emerald-100 bg-gradient-to-br from-[#fffdf8] to-emerald-50/80 text-slate-600">
      <div className="container py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg text-emerald-950"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-800 text-white shadow-sm shadow-emerald-900/15"
              >
                <BrandMark className="h-6 w-6" />
              </span>
              <span className="text-xl font-bold">Havestra</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6">
              Fresh harvests from local growers, brought closer to your home.
            </p>
          </div>

          <nav aria-label="Explore Havestra">
            <h2 className="font-semibold text-emerald-950">Explore</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/products" className={linkClass}>
                  Shop all produce
                </Link>
              </li>
              <li>
                <Link href="/products?category=Fruits" className={linkClass}>
                  Fruits
                </Link>
              </li>
              <li>
                <Link
                  href="/products?category=Vegetables"
                  className={linkClass}
                >
                  Vegetables
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Your Havestra account">
            <h2 className="font-semibold text-emerald-950">Your account</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/orders" className={linkClass}>
                  Orders and delivery
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className={linkClass}>
                  Wishlist
                </Link>
              </li>
              <li>
                <Link href="/cart" className={linkClass}>
                  Shopping cart
                </Link>
              </li>
              <li>
                <Link href="/profile" className={linkClass}>
                  Profile
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t border-emerald-100 pt-6 text-sm text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} Havestra. Fresh from local
            growers.
          </p>
        </div>
      </div>
    </footer>
  );
}
