import { useState, useEffect } from "react";

interface Package {
  id: string;
  name: string;
  price: number;
  description?: string;
  icon?: string;
}

interface PackageCalculatorProps {
  packages: Package[];
  onSelectionChange?: (selectedIds: string[], total: number) => void;
}

export default function PackageCalculator({
  packages,
  onSelectionChange,
}: PackageCalculatorProps) {
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(
    new Set()
  );

  // Calculate total whenever selection changes
  const total = Array.from(selectedPackages).reduce((sum, id) => {
    const pkg = packages.find((p) => p.id === id);
    return sum + (pkg?.price || 0);
  }, 0);

  useEffect(() => {
    onSelectionChange?.(Array.from(selectedPackages), total);
  }, [selectedPackages, total, onSelectionChange]);

  const togglePackage = (packageId: string) => {
    setSelectedPackages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(packageId)) {
        newSet.delete(packageId);
      } else {
        newSet.add(packageId);
      }
      return newSet;
    });
  };

  // Public method to enable a package (called from parent on voice trigger)
  useEffect(() => {
    // Expose method to parent component
    (window as any).enablePackage = (packageId: string) => {
      setSelectedPackages((prev) => new Set(prev).add(packageId));
    };

    return () => {
      delete (window as any).enablePackage;
    };
  }, []);

  const getPackageIcon = (packageId: string): string => {
    switch (packageId) {
      case "sport":
        return "🏉";
      case "movies":
        return "🎬";
      case "soho":
        return "📺";
      default:
        return "📦";
    }
  };

  const getPackageDescription = (packageId: string): string => {
    switch (packageId) {
      case "sport":
        return "Rugby, cricket, football and more";
      case "movies":
        return "Blockbusters, classics and premieres";
      case "soho":
        return "Premium drama and entertainment";
      default:
        return "";
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg border-2 border-primary-200">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">
          Sky TV Packages
        </h3>
        <p className="text-gray-600 text-sm">
          Select the packages that interest you
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => togglePackage(pkg.id)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              selectedPackages.has(pkg.id)
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">{getPackageIcon(pkg.id)}</div>
                <div>
                  <h4 className="font-semibold text-gray-800">{pkg.name}</h4>
                  <p className="text-sm text-gray-600">
                    {getPackageDescription(pkg.id)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-primary-600">
                  ${pkg.price.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">per month</div>
              </div>
            </div>
            <div className="mt-2 flex items-center">
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedPackages.has(pkg.id)
                    ? "bg-primary-500 border-primary-500"
                    : "border-gray-300"
                }`}
              >
                {selectedPackages.has(pkg.id) && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
              </div>
              <span className="ml-2 text-sm text-gray-600">
                {selectedPackages.has(pkg.id) ? "Selected" : "Click to add"}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Total Display */}
      <div className="border-t-2 border-gray-200 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-700 font-medium">Monthly Total:</span>
          <span className="text-3xl font-bold text-primary-600">
            ${total.toFixed(2)}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          {selectedPackages.size === 0
            ? "No packages selected"
            : `${selectedPackages.size} package${
                selectedPackages.size !== 1 ? "s" : ""
              } selected`}
        </div>

        {selectedPackages.size > 1 && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">
              <strong>Bundle Savings:</strong> Save 10% when you combine
              packages!
            </p>
          </div>
        )}
      </div>

      {/* Voice Trigger Indicator */}
      {selectedPackages.size > 0 && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          💬 Packages can be auto-selected based on customer responses
        </div>
      )}
    </div>
  );
}
