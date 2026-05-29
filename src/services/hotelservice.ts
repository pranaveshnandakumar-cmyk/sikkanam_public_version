function getPriceCategory(hotel: any) {
  const name = (
    hotel.tags?.name ||
    hotel.tags?.["name:en"] ||
    hotel.tags?.brand ||
    hotel.tags?.operator ||
    ""
  ).toLowerCase();

  const tourism = (hotel.tags?.tourism || "").toLowerCase();

  // 1. Premium keywords
  if (
    name.includes("resort") ||
    name.includes("spa") ||
    name.includes("palace") ||
    name.includes("luxury")
  ) {
    return "premium";
  }

  // 2. Comfort keywords
  if (
    name.includes("inn") ||
    name.includes("suites") ||
    name.includes("residency") ||
    name.includes("plaza")
  ) {
    return "comfort";
  }

  // 3. Budget keywords
  if (
    tourism === "hostel" ||
    tourism === "guest_house" ||
    name.includes("hostel") ||
    name.includes("lodge") ||
    name.includes("guest house") ||
    name.includes("guesthouse")
  ) {
    return "budget";
  }

  // 4. Fallback
  return "standard";
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return parseFloat(d.toFixed(1)); // Return to 1 decimal place (e.g. 1.2)
}

export async function getNearbyHotels(
  lat: number,
  lng: number
) {
  // Query nwr (nodes, ways, relations) and use "out center" to automatically get centers for polygons
  const query = `
    [out:json];
    (
      nwr["tourism"="hotel"](around:15000,${lat},${lng});
      nwr["tourism"="guest_house"](around:15000,${lat},${lng});
      nwr["tourism"="hostel"](around:15000,${lat},${lng});
    );
    out center;
  `;

  try {
    const res = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        body: query,
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    return data.elements.map((hotel: any) => {
      const category = getPriceCategory(hotel);
      const hotelLat = hotel.lat || hotel.center?.lat;
      const hotelLon = hotel.lon || hotel.center?.lon;
      const distance = calculateDistance(lat, lng, hotelLat, hotelLon);

      // Generate a stable realistic rating between 3.8 and 4.7 based on the element ID
      const baseId = hotel.id || 100;
      const stableOffset = (baseId % 10) / 10; // 0.0 to 0.9
      const rating = parseFloat((3.8 + stableOffset).toFixed(1));

      return {
        name:
          hotel.tags?.name ||
          hotel.tags?.["name:en"] ||
          hotel.tags?.brand ||
          hotel.tags?.operator ||
          null,

        type:
          hotel.tags?.tourism === "hotel"
            ? "comfort"
            : hotel.tags?.tourism === "hostel"
            ? "budget"
            : "standard",

        priceCategory: category,
        tier: category.charAt(0).toUpperCase() + category.slice(1),
        distanceKm: distance,

        rating: rating,

        amenities: [
          "WiFi",
          "Hot Water",
        ],

        lat: hotelLat,
        lng: hotelLon,
      };
    })
    .filter((hotel: any) => hotel.name && hotel.lat && hotel.lng)
    .slice(0, 6);
  } catch (err) {
    console.error(
      "Hotel fetch failed:",
      err
    );

    return [];
  }
}