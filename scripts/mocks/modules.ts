export const mockModules = [
  {
    name: "discounts",
    enabled: true,
    config: {
      defaultType: "percentage",
      defaultDiscount: 0,
      validCouponCodes: [
        {
          code: "BIENVENIDA10",
          type: "percentage",
          value: 0.1, // 10% OFF
          validUntil: "2030-12-31",
          minPurchase: 10000
        },
        {
          code: "MAYORISTA5000",
          type: "fixed",
          value: 5000, // $5000 OFF
          validUntil: "2030-12-31",
          minPurchase: 50000
        }
      ]
    }
  },
  {
    name: "taxes",
    enabled: true,
    config: {
      defaultRate: 0.21, // 21% IVA
      taxesIncludedInPrice: false,
      provincialRates: [
        {
          province: "CABA",
          rate: 0.03, // 3% Ingresos Brutos
          concept: "IIBB CABA"
        }
      ]
    }
  },
  {
    name: "shipping",
    enabled: true,
    config: {
      provider: "oca",
      freeShippingThreshold: 50000,
      flatRates: [
        { region: "CABA", rate: 2500, minPurchaseAmount: 0 },
        { region: "GBA", rate: 4000, minPurchaseAmount: 0 }
      ],
      pickupLocations: [
        {
          id: "loc_central",
          name: "Depósito Central",
          address: "Av. Industrial 123",
          city: "Buenos Aires",
          state: "CABA",
          zipCode: "1000",
          enabled: true
        }
      ]
    }
  }
]
