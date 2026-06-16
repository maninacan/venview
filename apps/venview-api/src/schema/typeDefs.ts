export const typeDefs = `#graphql

  scalar JSON

  # ─── User ────────────────────────────────────────────────────────────────────
  type Me {
    id: ID!
    email: String!
    isSuperAdmin: Boolean!
    companies: [Company!]!
  }

  # ─── Company ─────────────────────────────────────────────────────────────────
  type Company {
    id: ID!
    name: String!
    phone: String
    contactName: String
    vendorCategory: String
    email: String
    ownerId: ID!
    joinCode: String
    plan: String!
    subscriptionStatus: String
    currentPeriodEnd: String
    createdAt: String
    members: [CompanyMember!]!
    squareStatus: SquareStatus
  }

  type CompanyMember {
    userId: ID!
    email: String!
    role: String!
  }

  input CreateCompanyInput {
    name: String!
    phone: String
    contactName: String
    vendorCategory: String
    email: String
  }

  input UpdateCompanyInput {
    name: String
    phone: String
    contactName: String
    vendorCategory: String
    email: String
  }

  # ─── Events ──────────────────────────────────────────────────────────────────
  type Event {
    id: ID!
    companyId: ID!
    eventName: String!
    eventDate: String
    endDate: String
    status: String
    eventType: String
    eventHost: String
    eventLocation: String
    coordinator: String
    notes: String
    zipCode: String
    squareLocationId: String
    time: String
    applicationDate: String
    eventRating: String
    customFields: JSON
    numDays: Int
    isFinalized: Boolean!
    finalizedDate: String
    days: [EventDay!]!
    netProfit: Float
    sales: SalesSummary
  }

  type EventDay {
    id: ID!
    dayNumber: Int!
    eventDate: String
    startTime: String
    endTime: String
  }

  type SalesSummary {
    grossSales: Float
    netSales: Float
    discounts: Float
    refunds: Float
    tax: Float
    tips: Float
    squareFees: Float
    posFees: Float
    taxRate: Float
    taxOverride: Boolean
    totalCollected: Float
  }

  type EventExpenses {
    healthDeptFee: Float
    eventFee: Float
    mileage: Float
    mileageRate: Float
    laborFees: Float
    suppliesTotal: Float
    coordinatorFee: Float
    additionalFees: Float
    posFee: Float
    employeeBonus: Float
    eventRunnerFees: Float
  }

  type LaborEntry {
    id: ID!
    employeeId: ID
    name: String
    hours: Float
    wage: Float
    total: Float
  }

  type Supply {
    id: ID!
    name: String!
    quantity: Float
    unitCost: Float
    total: Float
    inventoryItemId: ID
  }

  type AdditionalFee {
    id: ID!
    label: String!
    amount: Float!
    isDiscount: Boolean!
  }

  type Permit {
    id: ID!
    fileName: String!
    "Short-lived signed URL minted on read (files are stored privately)."
    fileUrl: String
    uploadedAt: String
  }

  type TaxInfo {
    stateRate: Float
    stateFoodTax: Float
    taxDetail: JSON
  }

  type ReportSummary {
    posFees: Float
    cogs: Float
    grossProfit: Float
    totalExpenses: Float
    netProfit: Float
    tips: Float
    stateFoodTax: Float
    laborFees: Float
    additionalFeesTotal: Float
    mileageReimbursement: Float
  }

  type InventorySaleRow {
    name: String
    quantitySold: Float
    unitPrice: Float
    totalCost: Float
  }

  type EventReport {
    event: Event
    sales: SalesSummary
    expenses: EventExpenses
    taxes: TaxInfo
    summary: ReportSummary
    inventorySales: [InventorySaleRow!]!
    laborEntries: [LaborEntry!]!
    supplies: [Supply!]!
  }

  type EventKpi {
    totalEvents: Int!
    finalizedCount: Int!
    grossSales: Float!
    netSales: Float!
  }

  type EventTrend {
    eventId: ID!
    name: String!
    date: String!
    netProfit: Float!
  }

  input CreateEventInput {
    eventName: String!
    eventDate: String
    endDate: String
    status: String
    eventType: String
    eventHost: String
    eventLocation: String
    coordinator: String
    notes: String
    zipCode: String
    squareLocationId: String
    time: String
    applicationDate: String
    eventRating: String
    numDays: Int
    customFields: JSON
    days: [EventDayInput!]
  }

  input EventDayInput {
    dayNumber: Int!
    eventDate: String
    startTime: String
    endTime: String
  }

  input UpdateEventInput {
    eventName: String
    eventDate: String
    endDate: String
    status: String
    eventType: String
    eventHost: String
    eventLocation: String
    coordinator: String
    notes: String
    zipCode: String
    squareLocationId: String
    time: String
    applicationDate: String
    eventRating: String
    numDays: Int
    customFields: JSON
    days: [EventDayInput!]
  }

  input ManualSalesInput {
    grossSales: Float
    refunds: Float
    discounts: Float
    totalCollected: Float
  }

  input ExpensesInput {
    healthDeptFee: Float
    eventFee: Float
    mileage: Float
    mileageRate: Float
    coordinatorFee: Float
    posFee: Float
    employeeBonus: Float
    eventRunnerFees: Float
  }

  input LaborEntryInput {
    employeeId: ID
    name: String
    hours: Float!
    wage: Float!
  }

  input SupplyInput {
    name: String!
    quantity: Float
    unitCost: Float
    inventoryItemId: ID
  }

  input AdditionalFeeInput {
    label: String!
    amount: Float!
    isDiscount: Boolean!
  }

  # ─── Employees ───────────────────────────────────────────────────────────────
  type Employee {
    id: ID!
    companyId: ID!
    name: String!
    defaultWage: Float
  }

  # ─── Recipes ─────────────────────────────────────────────────────────────────
  type Recipe {
    id: ID!
    companyId: ID!
    name: String!
    totalCost: Float
    ingredients: [RecipeIngredient!]!
  }

  type RecipeIngredient {
    id: ID!
    name: String!
    quantity: Float!
    unitCost: Float!
    unit: String
  }

  input CreateRecipeInput {
    name: String!
    ingredients: [RecipeIngredientInput!]!
  }

  input RecipeIngredientInput {
    name: String!
    quantity: Float!
    unitCost: Float!
    unit: String
  }

  # ─── Inventory ───────────────────────────────────────────────────────────────
  type InventoryItem {
    id: ID!
    companyId: ID!
    name: String!
    category: String
    unitCost: Float!
    quantityOnHand: Float
    reorderThreshold: Float
    sku: String
  }

  type InventoryAlert {
    id: ID!
    item: InventoryItem!
    triggeredAt: String!
    isRead: Boolean!
  }

  type PosMapping {
    id: ID!
    posItemId: String!
    posItemName: String
    variationName: String
    inventoryItemId: ID
  }

  type EventInventory {
    id: ID!
    item: InventoryItem!
    quantityLoaded: Float!
    quantitySold: Float
    quantityRemaining: Float
  }

  input UpdateInventoryItemInput {
    name: String
    category: String
    unitCost: Float
    quantityOnHand: Float
    reorderThreshold: Float
    sku: String
  }

  input CreateInventoryItemInput {
    name: String!
    category: String
    unitCost: Float
    quantityOnHand: Float
    reorderThreshold: Float
    sku: String
  }

  input PosMappingInput {
    posSystem: String!
    posItemId: String!
    posItemName: String
    variationName: String
    inventoryId: ID
  }

  # ─── Form Templates ──────────────────────────────────────────────────────────
  type FormTemplate {
    id: ID!
    companyId: ID!
    templateName: String!
    fields: JSON!
    isActive: Boolean!
  }

  input SaveFormTemplateInput {
    templateName: String!
    fields: JSON!
  }

  # ─── Square ──────────────────────────────────────────────────────────────────
  type SquareStatus {
    connected: Boolean!
    locationName: String
    locationId: String
  }

  type SquareLocation {
    id: String!
    name: String!
  }

  type SquareCatalogItem {
    posItemId: String!
    posItemName: String!
    variationName: String
    price: Float
  }

  type SyncResult {
    success: Boolean!
    message: String
    unmatchedCount: Int
  }

  # ─── Admin ───────────────────────────────────────────────────────────────────
  type AdminUser {
    userId: ID!
    email: String!
    companyCount: Int!
    companies: [AdminCompany!]!
  }

  type AdminCompany {
    id: ID!
    name: String!
    plan: String!
    memberCount: Int!
  }

  type MonthCount {
    month: String!
    count: Int!
  }

  type ZipCount {
    zipCode: String!
    count: Int!
  }

  type StateCount {
    state: String!
    count: Int!
  }

  type CompanyLocation {
    id: ID!
    name: String!
    plan: String!
    lat: Float!
    lng: Float!
    city: String
    zipCode: String
    eventCount: Int!
    memberCount: Int!
  }

  type AdminDashboard {
    # Totals
    totalUsers: Int!
    totalCompanies: Int!
    totalEvents: Int!
    totalFinalizedEvents: Int!
    # Growth — trailing 30 days
    newUsers30d: Int!
    newCompanies30d: Int!
    newEvents30d: Int!
    newFinalizedEvents30d: Int!
    # Plans
    proCount: Int!
    starterCount: Int!
    # Activation
    activatedCompanies: Int!
    activationRate: Float!
    # Integrations
    squareConnectedCount: Int!
    squareConnectedRate: Float!
    # Engagement
    avgEventsPerCompany: Float!
    avgNetProfitPerEvent: Float
    # Health signals
    companiesInactive60d: Int!
    starterAtLimit: Int!
    # Trends (last 6 months)
    companiesByMonth: [MonthCount!]!
    eventsByMonth: [MonthCount!]!
    # Geography
    topZipCodes: [ZipCount!]!
    eventsByState: [StateCount!]!
  }

  # ─── Queries ─────────────────────────────────────────────────────────────────
  type Query {
    me: Me

    company(id: ID!): Company
    squareLocations(companyId: ID!): [SquareLocation!]!
    squareCatalog(companyId: ID!): [SquareCatalogItem!]!
    squareStatus(companyId: ID!): SquareStatus!

    events(companyId: ID!, filter: String, search: String, page: Int): [Event!]!
    event(id: ID!): Event
    eventReport(id: ID!): EventReport
    eventKpi(companyId: ID!): EventKpi!
    eventTrend(companyId: ID!): [EventTrend!]!

    employees(companyId: ID!): [Employee!]!

    recipes(companyId: ID!): [Recipe!]!

    inventory(companyId: ID!): [InventoryItem!]!
    inventoryAlerts(companyId: ID!): [InventoryAlert!]!
    lowStockItems(companyId: ID!): [InventoryItem!]!
    posMappings(companyId: ID!): [PosMapping!]!
    eventInventory(eventId: ID!): [EventInventory!]!

    formTemplates(companyId: ID!): [FormTemplate!]!

    adminUsers: [AdminUser!]!
    adminDashboard: AdminDashboard!
    companiesInState(state: String!): [CompanyLocation!]!
  }

  # ─── Mutations ───────────────────────────────────────────────────────────────
  type Mutation {
    # Company
    createCompany(input: CreateCompanyInput!): Company!
    updateCompany(id: ID!, input: UpdateCompanyInput!): Company!
    deleteCompany(id: ID!): Boolean!
    joinCompany(joinCode: String!): Company!
    leaveCompany(companyId: ID!): Boolean!
    removeMember(companyId: ID!, userId: ID!): Boolean!

    # Events
    createEvent(companyId: ID!, input: CreateEventInput!): Event!
    updateEvent(id: ID!, input: UpdateEventInput!): Event!
    deleteEvent(id: ID!): Boolean!
    finalizeEvent(id: ID!): Event!
    claimUnownedEvents(companyId: ID!): Int!

    # Sales
    syncSquareSales(eventId: ID!): SyncResult!
    updateManualSales(eventId: ID!, input: ManualSalesInput!): SalesSummary!
    updateTaxOverride(eventId: ID!, taxRate: Float!): SalesSummary!
    updateAdjustments(eventId: ID!, tips: Float, posFee: Float): Boolean!

    # Expenses
    updateExpenses(eventId: ID!, input: ExpensesInput!): EventExpenses!

    # Labor
    syncSquareLabor(eventId: ID!): SyncResult!
    createLaborEntry(eventId: ID!, input: LaborEntryInput!): LaborEntry!
    updateLaborEntry(id: ID!, input: LaborEntryInput!): LaborEntry!
    deleteLaborEntry(id: ID!): Boolean!

    # Employees
    createEmployee(companyId: ID!, name: String!, defaultWage: Float): Employee!
    updateEmployee(id: ID!, name: String, defaultWage: Float): Employee!
    deleteEmployee(id: ID!): Boolean!

    # Supplies
    createSupply(eventId: ID!, input: SupplyInput!): Supply!
    updateSupply(id: ID!, input: SupplyInput!): Supply!
    deleteSupply(id: ID!): Boolean!

    # Additional fees
    createAdditionalFee(eventId: ID!, input: AdditionalFeeInput!): AdditionalFee!
    updateAdditionalFee(id: ID!, input: AdditionalFeeInput!): AdditionalFee!
    deleteAdditionalFee(id: ID!): Boolean!

    # Recipes
    createRecipe(companyId: ID!, input: CreateRecipeInput!): Recipe!
    updateRecipe(id: ID!, input: CreateRecipeInput!): Recipe!
    deleteRecipe(id: ID!): Boolean!

    # Inventory
    createInventoryItem(companyId: ID!, input: CreateInventoryItemInput!): InventoryItem!
    updateInventoryItem(id: ID!, input: UpdateInventoryItemInput!): InventoryItem!
    deleteInventoryItem(id: ID!): Boolean!
    clearInventory(companyId: ID!): Boolean!
    savePosMappings(companyId: ID!, mappings: [PosMappingInput!]!): Boolean!

    # Event inventory
    updateEventInventory(eventId: ID!, inventoryItemId: ID!, quantityLoaded: Float!): EventInventory!
    restockEventInventory(eventId: ID!, eventInventoryId: ID!, quantity: Float!): EventInventory!

    # Inventory alerts
    markAlertRead(id: ID!): Boolean!
    markAllAlertsRead(companyId: ID!): Boolean!

    # Form templates
    saveFormTemplate(companyId: ID!, input: SaveFormTemplateInput!): FormTemplate!
    activateFormTemplate(companyId: ID!, templateId: ID!): Boolean!

    # Super Admin
    updateCompanyPlan(companyId: ID!, plan: String!): Company!
    setSuperAdmin(userId: ID!, isSuperAdmin: Boolean!): Boolean!

    # User prefs
    updateUserPrefs(prefs: JSON!): Boolean!
  }
`;
