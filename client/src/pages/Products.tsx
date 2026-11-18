import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronDown, Filter, Loader2, Search, X } from "lucide-react";
import { getProducts, Product, CATEGORIES } from "@/services/productService";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductsProps {
  basePath?: string;
}

export default function Products({ basePath = "/products" }: ProductsProps) {
  const [location, navigate] = useLocation();

  // Use a state for query params to ensure re-renders when they change
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useEffect(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    const params = new URLSearchParams(queryString);
    const q = params.get("search") || "";
    const cat = params.get("category") || "all";
    const sort = params.get("sortBy") || "newest";
    setSearchQuery(q);
    setSearchInput(q);
    setCategory(cat);
    setSortBy(
      ["price-low", "price-high", "rating", "newest"].includes(sort)
        ? (sort as typeof sortBy)
        : "newest"
    );
  }, [location]);

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<
    "price-low" | "price-high" | "rating" | "newest"
  >("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 12;

  useEffect(() => {
    setCurrentPage(1);
  }, [locationFilter, availability, minPrice, maxPrice]);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      try {
        const data = await getProducts(
          category === "all" ? undefined : category,
          searchQuery,
          sortBy,
          true,
          true
        );
        setProducts(data);
        setCurrentPage(1);
      } catch (error) {
        console.error("Failed to load products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [category, searchQuery, sortBy]);

  const availableLocations = Array.from(
    new Set(products.map(item => item.farmLocation))
  ).filter(Boolean);
  const activeFilterCount = [
    category !== "all",
    locationFilter !== "all",
    availability !== "all",
    minPrice !== "",
    maxPrice !== "",
  ].filter(Boolean).length;

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      if (locationFilter !== "all" && product.farmLocation !== locationFilter) {
        return false;
      }

      if (availability !== "all" && product.availability !== availability) {
        return false;
      }

      const minValue = Number(minPrice);
      const maxValue = Number(maxPrice);
      if (minPrice && !isNaN(minValue) && product.price < minValue) {
        return false;
      }
      if (maxPrice && !isNaN(maxValue) && product.price > maxValue) {
        return false;
      }

      return true;
    });
  }, [products, locationFilter, availability, minPrice, maxPrice]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  return (
    <div className="min-h-screen bg-[#F7F9F5]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header with Search */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Shop Products</h1>

            <div className="relative w-full md:max-w-md">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const query = searchInput.trim();
                  const params = new URLSearchParams(window.location.search);
                  if (query) {
                    params.set("search", query);
                  } else {
                    params.delete("search");
                  }
                  const newSearch = params.toString();
                  navigate(newSearch ? `${basePath}?${newSearch}` : basePath);
                }}
                className="relative"
              >
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="rounded-lg border border-gray-200 py-2 pl-10 pr-10 focus:ring-2 focus:ring-[#16834A]"
                />
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      const params = new URLSearchParams(
                        window.location.search
                      );
                      params.delete("search");
                      const newSearch = params.toString();
                      navigate(
                        newSearch ? `${basePath}?${newSearch}` : basePath
                      );
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#16834A]"
                  >
                    <X size={18} />
                  </button>
                )}
              </form>
            </div>
          </div>

          <p className="text-gray-600">
            {filteredProducts.length} products found
            {searchQuery && ` for "${searchQuery}"`}
          </p>
        </div>

        <button
          type="button"
          aria-expanded={filtersExpanded}
          aria-controls="product-filters"
          onClick={() => setFiltersExpanded(expanded => !expanded)}
          className="mb-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-emerald-100 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm md:hidden"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#16834A]" />
            More filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-[#16834A]">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              filtersExpanded ? "rotate-180" : ""
            }`}
          />
        </button>
        <div
          id="product-filters"
          className={`mb-6 gap-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm md:grid md:grid-cols-2 lg:grid-cols-4 ${
            filtersExpanded ? "grid" : "hidden"
          }`}
        >
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Farm Location</p>
            <Select
              value={locationFilter}
              onValueChange={value => setLocationFilter(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {availableLocations.map(location => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Availability</p>
            <Select
              value={availability}
              onValueChange={value => setAvailability(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All availability</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="pre-order">Pre-order</SelectItem>
                <SelectItem value="out-of-season">Out of season</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Min price</p>
              <Input
                type="number"
                min={0}
                placeholder="₱0"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Max price</p>
              <Input
                type="number"
                min={0}
                placeholder="₱999"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Category</p>
            <Select
              value={category}
              onValueChange={value => {
                setCategory(value);
                const params = new URLSearchParams(window.location.search);
                if (value === "all") {
                  params.delete("category");
                } else {
                  params.set("category", value);
                }
                const newSearch = params.toString();
                navigate(newSearch ? `${basePath}?${newSearch}` : basePath);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sort and Products Grid */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <Select
                value={sortBy}
                onValueChange={value => {
                  setSortBy(value as typeof sortBy);
                  const params = new URLSearchParams(window.location.search);
                  if (value === "newest") {
                    params.delete("sortBy");
                  } else {
                    params.set("sortBy", value);
                  }
                  const newSearch = params.toString();
                  const targetPath = newSearch
                    ? `${basePath}?${newSearch}`
                    : basePath;
                  navigate(targetPath);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="animate-spin text-[#16834A]" size={40} />
            </div>
          ) : paginatedProducts.length > 0 ? (
            <>
              <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
                {paginatedProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                  <Button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    page => (
                      <Button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={
                          page === currentPage
                            ? "bg-[#16834A] text-white"
                            : "bg-white border border-gray-200 text-gray-900 hover:bg-gray-50"
                        }
                      >
                        {page}
                      </Button>
                    )
                  )}

                  <Button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <p className="text-gray-600 mb-4">No products found</p>
              <Button
                onClick={() => {
                  const targetPath =
                    category === "all"
                      ? basePath
                      : `${basePath}?category=${encodeURIComponent(category)}`;
                  navigate(targetPath);
                  setSortBy("newest");
                }}
                className="bg-[#16834A] text-white hover:bg-[#116b3c]"
              >
                Clear Search
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
