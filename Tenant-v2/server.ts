import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Hot Deal interface matching requirements
interface HotDeal {
  id: string;
  serviceId: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  validFrom: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  maxRedemptions: number;
  redemptionCount: number;
  status: 'active' | 'paused' | 'scheduled' | 'expired' | 'rejected';
  rejectionReason: string | null;
  image: string;
  createdAt: string;
}

// Initial deals in memory database
let hotDeals: HotDeal[] = [
  {
    id: "deal-royal-massage",
    serviceId: "SRV-001",
    title_en: "Royal Relaxation Escape",
    title_ar: "هروب الاسترخاء الملكي",
    description_en: "Experience our signature Swedish massage with custom luxury aromatherapy oils at an exclusive price.",
    description_ar: "استمتعي بجلسة مساج سويدي ملكي فاخر بالزيوت العطرية المخصصة بسعر استثنائي ومحدود.",
    discountType: "percentage",
    discountValue: 25,
    validFrom: "2026-06-01",
    validUntil: "2026-07-15",
    maxRedemptions: 100,
    redemptionCount: 42,
    status: "active",
    rejectionReason: null,
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop",
    createdAt: "2026-06-01T12:00:00Z"
  },
  {
    id: "deal-hydrafacial",
    serviceId: "SRV-002",
    title_en: "Platinum Hydrafacial Special",
    title_ar: "عرض الهيدرافيشال البلاتيني المميز",
    description_en: "Renew your skin radiance with a complete multi-step deep hydration facial treatment.",
    description_ar: "جددي نضارة وإشراقة بشرتك مع جلسة تنظيف وترطيب خلايا البشرة العميقة المتكاملة.",
    discountType: "fixed_amount",
    discountValue: 80,
    validFrom: "2026-06-15",
    validUntil: "2026-07-31",
    maxRedemptions: 50,
    redemptionCount: 18,
    status: "active",
    rejectionReason: null,
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=800&auto=format&fit=crop",
    createdAt: "2026-06-15T09:30:00Z"
  },
  {
    id: "deal-nails-hair",
    serviceId: "SRV-004",
    title_en: "Weekend Collagen Spa Special",
    title_ar: "خصم نهاية الأسبوع للباديكير والمانيكير الكولاجين",
    description_en: "Treat yourself to a luxurious spa pedicure and manicure session with absolute comfort.",
    description_ar: "دللي نفسك مع جلسة العناية العميقة بالأظافر مع الكولاجين والترطيب الفاخر بنهاية الأسبوع.",
    discountType: "percentage",
    discountValue: 20,
    validFrom: "2026-07-01",
    validUntil: "2026-08-31",
    maxRedemptions: 30,
    redemptionCount: 0,
    status: "scheduled",
    rejectionReason: null,
    image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=800&auto=format&fit=crop",
    createdAt: "2026-06-25T14:15:00Z"
  },
  {
    id: "deal-hair-treatment",
    serviceId: "SRV-005",
    title_en: "Vegan Keratin Hair Therapy",
    title_ar: "علاج الكيراتين النباتي للشعر",
    description_en: "Revitalize hair health with our premium plant-based botanical keratin therapy.",
    description_ar: "استعيدي حيوية وصحة شعرك مع علاج الكيراتين النباتي العضوي الفاخر والمغذي.",
    discountType: "fixed_amount",
    discountValue: 150,
    validFrom: "2026-06-01",
    validUntil: "2026-06-25",
    maxRedemptions: 20,
    redemptionCount: 20,
    status: "expired",
    rejectionReason: null,
    image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=800&auto=format&fit=crop",
    createdAt: "2026-05-28T08:00:00Z"
  },
  {
    id: "deal-hair-styling",
    serviceId: "SRV-003",
    title_en: "Premium Style & Blowdry Deal",
    title_ar: "عرض تصفيف الشعر والسيشوار المائي",
    description_en: "Look your absolute best for any special event with our master hair stylists.",
    description_ar: "تألقي بمظهر باهر وجذاب في جميع مناسباتك الخاصة مع خبيرات تصفيف الشعر لدينا.",
    discountType: "percentage",
    discountValue: 40,
    validFrom: "2026-06-10",
    validUntil: "2026-07-10",
    maxRedemptions: 40,
    redemptionCount: 5,
    status: "rejected",
    rejectionReason: "The discount value (40%) is higher than the franchise allowed marketing threshold (30%) for core hair services.",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=800&auto=format&fit=crop",
    createdAt: "2026-06-08T11:00:00Z"
  }
];

// Package constraints config
const PACKAGE_LIMITS = {
  maxHotDeals: 10,
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Endpoints for Hot Deals module

  // 1. GET /api/v1/tenant/hot-deals/limits
  app.get("/api/v1/tenant/hot-deals/limits", (req, res) => {
    try {
      const activeAndScheduledCount = hotDeals.filter(d => d.status === 'active' || d.status === 'scheduled' || d.status === 'paused').length;
      res.json({
        maxHotDeals: PACKAGE_LIMITS.maxHotDeals,
        currentHotDeals: activeAndScheduledCount,
        remaining: Math.max(0, PACKAGE_LIMITS.maxHotDeals - activeAndScheduledCount),
        totalCreated: hotDeals.length
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load package limits." });
    }
  });

  // 2. GET /api/v1/tenant/hot-deals
  app.get("/api/v1/tenant/hot-deals", (req, res) => {
    try {
      // Return sorted by creation date descending
      const sorted = [...hotDeals].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(sorted);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load hot deals." });
    }
  });

  // 3. GET /api/v1/tenant/hot-deals/:id
  app.get("/api/v1/tenant/hot-deals/:id", (req, res) => {
    try {
      const deal = hotDeals.find(d => d.id === req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Hot deal not found." });
      }
      res.json(deal);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to find hot deal." });
    }
  });

  // 4. POST /api/v1/tenant/hot-deals
  app.post("/api/v1/tenant/hot-deals", (req, res) => {
    try {
      const {
        serviceId,
        title_en,
        title_ar,
        description_en,
        description_ar,
        discountType,
        discountValue,
        validFrom,
        validUntil,
        maxRedemptions,
        image
      } = req.body;

      // Validation
      if (!image) {
        return res.status(400).json({ error: "Deal image is required." });
      }
      if (!serviceId) {
        return res.status(400).json({ error: "Service selection is required." });
      }
      if (!title_en || !title_ar) {
        return res.status(400).json({ error: "Titles in both languages are required." });
      }
      if (!discountType || discountValue === undefined) {
        return res.status(400).json({ error: "Discount type and value are required." });
      }
      if (new Date(validUntil) <= new Date(validFrom)) {
        return res.status(400).json({ error: "Validity end date must be strictly after valid from date." });
      }

      // Check Limits
      const activeAndScheduledCount = hotDeals.filter(d => d.status === 'active' || d.status === 'scheduled' || d.status === 'paused').length;
      if (activeAndScheduledCount >= PACKAGE_LIMITS.maxHotDeals) {
        return res.status(400).json({ error: `Package limit reached. You can only have up to ${PACKAGE_LIMITS.maxHotDeals} active/scheduled hot deals.` });
      }

      // Determine initial status based on date
      const todayStr = new Date().toISOString().split('T')[0];
      let status: 'active' | 'scheduled' | 'expired' = 'active';
      if (validFrom > todayStr) {
        status = 'scheduled';
      } else if (validUntil < todayStr) {
        status = 'expired';
      }

      const newDeal: HotDeal = {
        id: `deal-${Date.now()}`,
        serviceId,
        title_en,
        title_ar,
        description_en: description_en || "",
        description_ar: description_ar || "",
        discountType,
        discountValue: Number(discountValue),
        validFrom,
        validUntil,
        maxRedemptions: Number(maxRedemptions) || 100,
        redemptionCount: 0,
        status,
        rejectionReason: null,
        image,
        createdAt: new Date().toISOString()
      };

      hotDeals.push(newDeal);
      res.status(201).json(newDeal);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create hot deal." });
    }
  });

  // 5. PUT /api/v1/tenant/hot-deals/:id
  app.put("/api/v1/tenant/hot-deals/:id", (req, res) => {
    try {
      const { id } = req.params;
      const index = hotDeals.findIndex(d => d.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Hot deal not found." });
      }

      const {
        serviceId,
        title_en,
        title_ar,
        description_en,
        description_ar,
        discountType,
        discountValue,
        validFrom,
        validUntil,
        maxRedemptions,
        image
      } = req.body;

      // Validation
      if (!serviceId) {
        return res.status(400).json({ error: "Service selection is required." });
      }
      if (!title_en || !title_ar) {
        return res.status(400).json({ error: "Titles in both languages are required." });
      }
      if (!discountType || discountValue === undefined) {
        return res.status(400).json({ error: "Discount type and value are required." });
      }
      if (new Date(validUntil) <= new Date(validFrom)) {
        return res.status(400).json({ error: "Validity end date must be strictly after valid from date." });
      }

      const existingDeal = hotDeals[index];

      // Determine appropriate status
      const todayStr = new Date().toISOString().split('T')[0];
      let updatedStatus = existingDeal.status;
      if (updatedStatus !== 'paused' && updatedStatus !== 'rejected') {
        if (validFrom > todayStr) {
          updatedStatus = 'scheduled';
        } else if (validUntil < todayStr) {
          updatedStatus = 'expired';
        } else {
          updatedStatus = 'active';
        }
      }

      const updatedDeal: HotDeal = {
        ...existingDeal,
        serviceId,
        title_en,
        title_ar,
        description_en: description_en || "",
        description_ar: description_ar || "",
        discountType,
        discountValue: Number(discountValue),
        validFrom,
        validUntil,
        maxRedemptions: Number(maxRedemptions) || 100,
        image: image || existingDeal.image,
        status: updatedStatus
      };

      hotDeals[index] = updatedDeal;
      res.json(updatedDeal);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update hot deal." });
    }
  });

  // 6. POST /api/v1/tenant/hot-deals/:id/pause
  app.post("/api/v1/tenant/hot-deals/:id/pause", (req, res) => {
    try {
      const deal = hotDeals.find(d => d.id === req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Hot deal not found." });
      }
      deal.status = 'paused';
      res.json(deal);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to pause hot deal." });
    }
  });

  // 7. POST /api/v1/tenant/hot-deals/:id/resume
  app.post("/api/v1/tenant/hot-deals/:id/resume", (req, res) => {
    try {
      const deal = hotDeals.find(d => d.id === req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Hot deal not found." });
      }
      
      // Determine if it should be active or scheduled or expired
      const todayStr = new Date().toISOString().split('T')[0];
      if (deal.validFrom > todayStr) {
        deal.status = 'scheduled';
      } else if (deal.validUntil < todayStr) {
        deal.status = 'expired';
      } else {
        deal.status = 'active';
      }
      deal.rejectionReason = null; // Clear rejection if resubmitted/resumed

      res.json(deal);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to resume hot deal." });
    }
  });

  // 8. DELETE /api/v1/tenant/hot-deals/:id
  app.delete("/api/v1/tenant/hot-deals/:id", (req, res) => {
    try {
      const index = hotDeals.findIndex(d => d.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: "Hot deal not found." });
      }
      hotDeals.splice(index, 1);
      res.json({ success: true, message: "Hot deal deleted successfully." });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete hot deal." });
    }
  });


  // ==========================================
  // CUSTOMER PUSH NOTIFICATIONS MODULE
  // ==========================================

  interface NotificationHistoryItem {
    id: string;
    title: string;
    message: string;
    linkType: 'general' | 'service' | 'deal';
    serviceId: string | null;
    image: string | null;
    sendToAll: boolean;
    audienceType: 'All Customers' | 'Segmented';
    recipientCount: number;
    status: 'completed' | 'failed' | 'warning';
    createdAt: string;
    requestPayload: any;
    responsePayload: any;
    timestamps: {
      created: string;
      processed: string;
      completed: string;
    };
    counts: {
      sent: number;
      delivered: number;
      skipped: number;
      failed: number;
    };
    skippedReasons: Array<{
      customerId: string;
      name: string;
      reason: string;
    }>;
    recipientResults: Array<{
      customerId: string;
      name: string;
      phone: string;
      status: 'delivered' | 'failed' | 'skipped';
      deliveryToken: string | null;
      error?: string;
    }>;
  }

  let notificationHistory: NotificationHistoryItem[] = [
    {
      id: "push-101",
      title: "Prestige Collagen Pedicure Weekend!",
      message: "Treat yourself to a luxurious collagen spa session. 20% off only this weekend!",
      linkType: "deal",
      serviceId: "SRV-004",
      image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=800&auto=format&fit=crop",
      sendToAll: true,
      audienceType: "All Customers",
      recipientCount: 5,
      status: "completed",
      createdAt: "2026-06-29T14:30:00.000Z",
      requestPayload: {
        title: "Prestige Collagen Pedicure Weekend!",
        message: "Treat yourself to a luxurious collagen spa session. 20% off only this weekend!",
        linkType: "deal",
        serviceId: "SRV-004",
        image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=800&auto=format&fit=crop",
        sendToAll: true
      },
      responsePayload: {
        multicast_id: 819203810293021,
        success: 5,
        failure: 0,
        canonical_ids: 0,
        results: [
          { message_id: "msg_col_001" },
          { message_id: "msg_col_002" },
          { message_id: "msg_col_003" },
          { message_id: "msg_col_004" },
          { message_id: "msg_col_005" }
        ]
      },
      timestamps: {
        created: "2026-06-29T14:30:00.010Z",
        processed: "2026-06-29T14:30:00.150Z",
        completed: "2026-06-29T14:30:00.420Z"
      },
      counts: {
        sent: 5,
        delivered: 5,
        skipped: 0,
        failed: 0
      },
      skippedReasons: [],
      recipientResults: [
        { customerId: "CUST-001", name: "سارة عبد الله", phone: "+966 50 123 4567", status: "delivered", deliveryToken: "token_sarah_9921" },
        { customerId: "CUST-002", name: "مها الشمري", phone: "+966 54 876 5432", status: "delivered", deliveryToken: "token_maha_3312" },
        { customerId: "CUST-003", name: "أروى العتيبي", phone: "+966 56 345 6789", status: "delivered", deliveryToken: "token_arwa_4523" },
        { customerId: "CUST-004", name: "فاطمة الدوسري", phone: "+966 55 987 6543", status: "delivered", deliveryToken: "token_fatimah_1102" },
        { customerId: "CUST-005", name: "نجلاء آل سعود", phone: "+966 50 999 8888", status: "delivered", deliveryToken: "token_najla_8871" }
      ]
    },
    {
      id: "push-102",
      title: "Skincare Renewal Alert 🌸",
      message: "A complimentary deep mask upgrade is waiting for VIP prestige members. Check your app!",
      linkType: "service",
      serviceId: "SRV-002",
      image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=800&auto=format&fit=crop",
      sendToAll: false,
      audienceType: "Segmented",
      recipientCount: 3,
      status: "completed",
      createdAt: "2026-06-25T11:15:00.000Z",
      requestPayload: {
        title: "Skincare Renewal Alert 🌸",
        message: "A complimentary deep mask upgrade is waiting for VIP prestige members. Check your app!",
        linkType: "service",
        serviceId: "SRV-002",
        image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=800&auto=format&fit=crop",
        sendToAll: false,
        customerIds: ["CUST-001", "CUST-003", "CUST-005"]
      },
      responsePayload: {
        multicast_id: 284019283019283,
        success: 3,
        failure: 0,
        canonical_ids: 0,
        results: [
          { message_id: "msg_skin_001" },
          { message_id: "msg_skin_003" },
          { message_id: "msg_skin_005" }
        ]
      },
      timestamps: {
        created: "2026-06-25T11:15:00.012Z",
        processed: "2026-06-25T11:15:00.100Z",
        completed: "2026-06-25T11:15:00.280Z"
      },
      counts: {
        sent: 3,
        delivered: 3,
        skipped: 2,
        failed: 0
      },
      skippedReasons: [
        { customerId: "CUST-002", name: "مها الشمري", reason: "Not specified in manual segment criteria selection." },
        { customerId: "CUST-004", name: "فاطمة الدوسري", reason: "Not specified in manual segment criteria selection." }
      ],
      recipientResults: [
        { customerId: "CUST-001", name: "سارة عبد الله", phone: "+966 50 123 4567", status: "delivered", deliveryToken: "token_sarah_9921" },
        { customerId: "CUST-003", name: "أروى العتيبي", phone: "+966 56 345 6789", status: "delivered", deliveryToken: "token_arwa_4523" },
        { customerId: "CUST-005", name: "نجلاء آل سعود", phone: "+966 50 999 8888", status: "delivered", deliveryToken: "token_najla_8871" }
      ]
    }
  ];

  let totalNotificationsSent = 8;
  const NOTIFICATION_LIMIT = 5000;
  let lastAttemptDebug: NotificationHistoryItem | null = { ...notificationHistory[0] };

  // 1. GET /api/v1/tenant/notifications/usage
  app.get("/api/v1/tenant/notifications/usage", (req, res) => {
    try {
      res.json({
        limit: NOTIFICATION_LIMIT,
        sent: totalNotificationsSent,
        remaining: Math.max(0, NOTIFICATION_LIMIT - totalNotificationsSent),
        deliverySuccessRate: 99.4,
        lastAttempt: lastAttemptDebug
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load usage summary statistics." });
    }
  });

  // 2. POST /api/v1/tenant/notifications/send
  app.post("/api/v1/tenant/notifications/send", (req, res) => {
    try {
      const { title, message, linkType, serviceId, image, sendToAll, customerIds } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: "Notification title and message are required fields." });
      }

      if (!sendToAll && (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0)) {
        return res.status(400).json({ error: "Please select at least one recipient customer, or toggle 'Send to all'." });
      }

      const todayStr = new Date().toISOString();
      
      const customers = [
        { id: 'CUST-001', name: 'سارة عبد الله', phone: '+966 50 123 4567' },
        { id: 'CUST-002', name: 'مها الشمري', phone: '+966 54 876 5432' },
        { id: 'CUST-003', name: 'أروى العتيبي', phone: '+966 56 345 6789' },
        { id: 'CUST-004', name: 'فاطمة الدوسري', phone: '+966 55 987 6543' },
        { id: 'CUST-005', name: 'نجلاء آل سعود', phone: '+966 50 999 8888' }
      ];

      const targetCustomers = sendToAll ? customers : customers.filter(c => customerIds.includes(c.id));
      const skippedCustomers = sendToAll ? [] : customers.filter(c => !customerIds.includes(c.id));

      const newId = `push-${Date.now()}`;
      const sentCount = targetCustomers.length;

      const results = targetCustomers.map((c, i) => {
        return {
          customerId: c.id,
          name: c.name,
          phone: c.phone,
          status: 'delivered' as const,
          deliveryToken: `token_${c.id.toLowerCase().replace('-', '_')}_${Math.floor(1000 + Math.random() * 9000)}`
        };
      });

      const skippedReasons = skippedCustomers.map(c => ({
        customerId: c.id,
        name: c.name,
        reason: "Excluded based on manual recipient criteria check."
      }));

      const responsePayload = {
        multicast_id: Math.floor(100000000000000 + Math.random() * 900000000000000),
        success: sentCount,
        failure: 0,
        canonical_ids: 0,
        results: results.map((r, i) => ({
          message_id: `msg_fcm_${newId}_${i}`
        }))
      };

      const newHistory: NotificationHistoryItem = {
        id: newId,
        title,
        message,
        linkType: linkType || 'general',
        serviceId: serviceId || null,
        image: image || null,
        sendToAll: !!sendToAll,
        audienceType: sendToAll ? "All Customers" : "Segmented",
        recipientCount: sentCount,
        status: "completed",
        createdAt: todayStr,
        requestPayload: req.body,
        responsePayload: responsePayload,
        timestamps: {
          created: new Date(Date.now() - 40).toISOString(),
          processed: new Date(Date.now() - 15).toISOString(),
          completed: todayStr
        },
        counts: {
          sent: sentCount,
          delivered: sentCount,
          skipped: skippedCustomers.length,
          failed: 0
        },
        skippedReasons,
        recipientResults: results
      };

      notificationHistory.unshift(newHistory);
      totalNotificationsSent += sentCount;
      lastAttemptDebug = newHistory;

      res.status(201).json(newHistory);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to broadcast notifications." });
    }
  });

  // 3. POST /api/v1/tenant/notifications/image
  app.post("/api/v1/tenant/notifications/image", (req, res) => {
    try {
      const { image } = req.body;
      res.json({
        imageUrl: image || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop"
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to process image upload." });
    }
  });

  // 4. GET /api/v1/tenant/notifications/history
  app.get("/api/v1/tenant/notifications/history", (req, res) => {
    try {
      res.json(notificationHistory);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load history." });
    }
  });

  // 5. GET /api/v1/tenant/notifications/history/:id
  app.get("/api/v1/tenant/notifications/history/:id", (req, res) => {
    try {
      const item = notificationHistory.find(h => h.id === req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Notification dispatch log not found." });
      }
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load notification details." });
    }
  });

  // 6. GET /api/v1/tenant/notifications/history/:id/recipients
  app.get("/api/v1/tenant/notifications/history/:id/recipients", (req, res) => {
    try {
      const item = notificationHistory.find(h => h.id === req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Notification dispatch log not found." });
      }
      res.json({
        id: item.id,
        recipientResults: item.recipientResults,
        skippedReasons: item.skippedReasons
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load recipients list." });
    }
  });


  // ==========================================
  // GIFT CARDS MODULE
  // ==========================================

  interface GiftCardPackage {
    id: string;
    title: string;
    description: string;
    displayOrder: number;
    walletCreditAmount: number;
    discountPreset: 'none' | 'percentage' | 'custom';
    customDiscountPercent: number;
    bonusAmount: number;
    expirationPreset: 'none' | '1month' | '3months' | '6months' | '1year';
    isActive: boolean;
    image: string;
  }

  interface Redemption {
    id: string;
    code: string;
    customerName: string;
    customerPhone: string;
    amount: number;
    appointmentId: string | null;
    redeemedAt: string;
    redeemedBy: 'admin' | 'tenant';
    status: 'success' | 'reversed';
  }

  interface GiftCardTransaction {
    id: string;
    packageName: string;
    code: string;
    buyerName: string;
    recipientName: string;
    amountPaid: number;
    walletCreditAmount: number;
    bonusAmount: number;
    purchasedAt: string;
    status: 'completed' | 'refunded';
  }

  // Pre-seed gift card packages
  let giftCardPackages: GiftCardPackage[] = [
    {
      id: "pkg-1",
      title: "Silver Pamper Card",
      description: "Enjoy luxurious care with supplementary bonus. Perfect for standard recurring treatments.",
      displayOrder: 1,
      walletCreditAmount: 250,
      discountPreset: "percentage",
      customDiscountPercent: 10,
      bonusAmount: 25,
      expirationPreset: "6months",
      isActive: true,
      image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=800&auto=format&fit=crop"
    },
    {
      id: "pkg-2",
      title: "Golden Radiance Card",
      description: "Our most popular premium selection. Restores skin glow with a high bonus.",
      displayOrder: 2,
      walletCreditAmount: 500,
      discountPreset: "percentage",
      customDiscountPercent: 15,
      bonusAmount: 50,
      expirationPreset: "1year",
      isActive: true,
      image: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?q=80&w=800&auto=format&fit=crop"
    },
    {
      id: "pkg-3",
      title: "Royal Platinum Indulgence",
      description: "The ultimate salon prestige package. Fully loaded with maximum bonus, custom priority salon benefits.",
      displayOrder: 3,
      walletCreditAmount: 1000,
      discountPreset: "custom",
      customDiscountPercent: 20,
      bonusAmount: 150,
      expirationPreset: "1year",
      isActive: true,
      image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=800&auto=format&fit=crop"
    }
  ];

  // Pre-seed redemptions logs
  let redemptions: Redemption[] = [
    {
      id: "red-01",
      code: "REF-GFT-9821-SA",
      customerName: "سارة عبد الله",
      customerPhone: "+966 50 123 4567",
      amount: 250,
      appointmentId: "APT-1092",
      redeemedAt: "2026-06-29T16:45:00.000Z",
      redeemedBy: "tenant",
      status: "success"
    },
    {
      id: "red-02",
      code: "REF-GFT-5412-SA",
      customerName: "مها الشمري",
      customerPhone: "+966 54 876 5432",
      amount: 120,
      appointmentId: "APT-1088",
      redeemedAt: "2026-06-28T11:15:00.000Z",
      redeemedBy: "admin",
      status: "success"
    },
    {
      id: "red-03",
      code: "REF-GFT-3091-SA",
      customerName: "فاطمة الدوسري",
      customerPhone: "+966 55 987 6543",
      amount: 500,
      appointmentId: "APT-1077",
      redeemedAt: "2026-06-26T14:30:00.000Z",
      redeemedBy: "tenant",
      status: "success"
    },
    {
      id: "red-04",
      code: "REF-GFT-8812-SA",
      customerName: "نجلاء آل سعود",
      customerPhone: "+966 50 999 8888",
      amount: 450,
      appointmentId: null,
      redeemedAt: "2026-06-25T19:00:00.000Z",
      redeemedBy: "admin",
      status: "success"
    }
  ];

  // Pre-seed gift card transaction purchases
  let giftCardTransactions: GiftCardTransaction[] = [
    {
      id: "TX-GFT-1001",
      packageName: "Silver Pamper Card",
      code: "REF-GFT-9821-SA",
      buyerName: "أحمد الشمري",
      recipientName: "سارة عبد الله",
      amountPaid: 225,
      walletCreditAmount: 250,
      bonusAmount: 25,
      purchasedAt: "2026-06-29T10:00:00.000Z",
      status: "completed"
    },
    {
      id: "TX-GFT-1002",
      packageName: "Golden Radiance Card",
      code: "REF-GFT-5412-SA",
      buyerName: "نورة العتيبي",
      recipientName: "مها الشمري",
      amountPaid: 425,
      walletCreditAmount: 500,
      bonusAmount: 50,
      purchasedAt: "2026-06-28T09:12:00.000Z",
      status: "completed"
    },
    {
      id: "TX-GFT-1003",
      packageName: "Royal Platinum Indulgence",
      code: "REF-GFT-3091-SA",
      buyerName: "أمل الدوسري",
      recipientName: "فاطمة الدوسري",
      amountPaid: 800,
      walletCreditAmount: 1000,
      bonusAmount: 150,
      purchasedAt: "2026-06-25T15:20:00.000Z",
      status: "completed"
    },
    {
      id: "TX-GFT-1004",
      packageName: "Golden Radiance Card",
      code: "REF-GFT-8812-SA",
      buyerName: "رائد آل سعود",
      recipientName: "نجلاء آل سعود",
      amountPaid: 425,
      walletCreditAmount: 500,
      bonusAmount: 50,
      purchasedAt: "2026-06-24T18:40:00.000Z",
      status: "completed"
    }
  ];

  // Helper values for reports summary
  const getReportsSummary = () => {
    const totalRedemptions = redemptions.length;
    const redeemedAmount = redemptions.reduce((acc, curr) => acc + curr.amount, 0);
    const adminRedeemedAmount = redemptions
      .filter(r => r.redeemedBy === 'admin')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const tenantRedeemedAmount = redemptions
      .filter(r => r.redeemedBy === 'tenant')
      .reduce((acc, curr) => acc + curr.amount, 0);

    return {
      totalRedemptions,
      redeemedAmount,
      adminRedeemedAmount,
      tenantRedeemedAmount
    };
  };

  // 1. GET /api/v1/tenant/gift-cards/packages
  app.get("/api/v1/tenant/gift-cards/packages", (req, res) => {
    try {
      // Sort by display order
      const sorted = [...giftCardPackages].sort((a, b) => a.displayOrder - b.displayOrder);
      res.json(sorted);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load gift card packages." });
    }
  });

  // 2. POST /api/v1/tenant/gift-cards/packages
  app.post("/api/v1/tenant/gift-cards/packages", (req, res) => {
    try {
      const { 
        title, 
        description, 
        displayOrder, 
        walletCreditAmount, 
        discountPreset, 
        customDiscountPercent, 
        bonusAmount, 
        expirationPreset, 
        isActive, 
        image 
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Title is a required field." });
      }
      if (!walletCreditAmount || Number(walletCreditAmount) <= 0) {
        return res.status(400).json({ error: "Wallet credit amount must be greater than 0." });
      }
      const discPercent = Number(customDiscountPercent || 0);
      if (discPercent < 0 || discPercent > 100) {
        return res.status(400).json({ error: "Custom discount percentage must be between 0 and 100." });
      }
      if (!image) {
        return res.status(400).json({ error: "A gorgeous background image cover is required on creation." });
      }

      const newPkg: GiftCardPackage = {
        id: `pkg-${Date.now()}`,
        title,
        description: description || "",
        displayOrder: Number(displayOrder || 1),
        walletCreditAmount: Number(walletCreditAmount),
        discountPreset: discountPreset || 'none',
        customDiscountPercent: discPercent,
        bonusAmount: Number(bonusAmount || 0),
        expirationPreset: expirationPreset || 'none',
        isActive: isActive !== undefined ? !!isActive : true,
        image
      };

      giftCardPackages.push(newPkg);
      res.status(201).json(newPkg);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create gift card package." });
    }
  });

  // 3. PUT /api/v1/tenant/gift-cards/packages/:id
  app.put("/api/v1/tenant/gift-cards/packages/:id", (req, res) => {
    try {
      const { id } = req.params;
      const index = giftCardPackages.findIndex(p => p.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Gift card package not found." });
      }

      const { 
        title, 
        description, 
        displayOrder, 
        walletCreditAmount, 
        discountPreset, 
        customDiscountPercent, 
        bonusAmount, 
        expirationPreset, 
        isActive, 
        image 
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Title is a required field." });
      }
      if (!walletCreditAmount || Number(walletCreditAmount) <= 0) {
        return res.status(400).json({ error: "Wallet credit amount must be greater than 0." });
      }
      const discPercent = Number(customDiscountPercent || 0);
      if (discPercent < 0 || discPercent > 100) {
        return res.status(400).json({ error: "Custom discount percentage must be between 0 and 100." });
      }

      // Merge fields (allow reusing old image if not supplied)
      giftCardPackages[index] = {
        ...giftCardPackages[index],
        title,
        description: description || "",
        displayOrder: Number(displayOrder || 1),
        walletCreditAmount: Number(walletCreditAmount),
        discountPreset: discountPreset || 'none',
        customDiscountPercent: discPercent,
        bonusAmount: Number(bonusAmount || 0),
        expirationPreset: expirationPreset || 'none',
        isActive: isActive !== undefined ? !!isActive : true,
        image: image || giftCardPackages[index].image
      };

      res.json(giftCardPackages[index]);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update gift card package." });
    }
  });

  // 4. PATCH /api/v1/tenant/gift-cards/packages/:id/active
  app.patch("/api/v1/tenant/gift-cards/packages/:id/active", (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const index = giftCardPackages.findIndex(p => p.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Gift card package not found." });
      }

      giftCardPackages[index].isActive = !!isActive;
      res.json(giftCardPackages[index]);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to toggle active status." });
    }
  });

  // 5. POST /api/v1/tenant/gift-cards/packages/:id/image
  app.post("/api/v1/tenant/gift-cards/packages/:id/image", (req, res) => {
    try {
      const { id } = req.params;
      const { image } = req.body;
      const index = giftCardPackages.findIndex(p => p.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Gift card package not found." });
      }

      if (!image) {
        return res.status(400).json({ error: "No image file content supplied." });
      }

      // In-memory update
      giftCardPackages[index].image = image;
      res.json({ imageUrl: image });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to process image upload." });
    }
  });

  // 6. GET /api/v1/tenant/gift-cards/reports/summary
  app.get("/api/v1/tenant/gift-cards/reports/summary", (req, res) => {
    try {
      res.json(getReportsSummary());
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load reports summary." });
    }
  });

  // 7. GET /api/v1/tenant/gift-cards/reports/transactions
  app.get("/api/v1/tenant/gift-cards/reports/transactions", (req, res) => {
    try {
      res.json(giftCardTransactions);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load reports transactions." });
    }
  });

  // 8. GET /api/v1/tenant/gift-cards/reports/transactions.csv
  app.get("/api/v1/tenant/gift-cards/reports/transactions.csv", (req, res) => {
    try {
      // Build proper RFC 4180 CSV
      const headers = ["Transaction ID", "Package Name", "Gift Code", "Buyer Name", "Recipient Name", "Amount Paid", "Wallet Credit", "Bonus Amount", "Purchased At", "Status"];
      const rows = giftCardTransactions.map(tx => [
        `"${tx.id}"`,
        `"${tx.packageName.replace(/"/g, '""')}"`,
        `"${tx.code}"`,
        `"${tx.buyerName.replace(/"/g, '""')}"`,
        `"${tx.recipientName.replace(/"/g, '""')}"`,
        tx.amountPaid,
        tx.walletCreditAmount,
        tx.bonusAmount,
        `"${tx.purchasedAt}"`,
        `"${tx.status}"`
      ]);

      const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");

      // Set response headers to force download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="refah_gift_cards_transactions.csv"');
      res.status(200).send(csvContent);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to compile transactions csv." });
    }
  });

  // 9. GET /api/v1/tenant/gift-cards/reports/redemptions
  app.get("/api/v1/tenant/gift-cards/reports/redemptions", (req, res) => {
    try {
      res.json(redemptions);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load redemptions." });
    }
  });


  // ==========================================
  // REVIEWS MODERATION MODULE
  // ==========================================

  interface Review {
    id: string;
    customer: string;
    rating: number;
    employee: string; // e.g. "Nadeen Al-Harbi" / "نادين الحربي"
    commentAr: string;
    commentEn: string;
    reply: string | null;
    date: string; // ISO String
    isVisible: boolean;
  }

  let reviews: Review[] = [
    {
      id: "rev-1",
      customer: "هيا البنيان",
      rating: 5,
      employee: "نادين الحربي (Nadeen Al-Harbi)",
      commentAr: "تجربة استثنائية بكل المعايير! الفرع غاية في الفخامة والروعة، ونادين الحربي فنانة حقيقية بالقص والصبغ. سأكرر الزيارة بالتأكيد.",
      commentEn: "An exceptional experience by all standards! The branch is extremely luxurious and beautiful, and Nadeen Al-Harbi is a true artist in cutting and coloring. I will definitely visit again.",
      reply: "يسعدنا جداً سماع ذلك يا هيا! فخورون دائماً بتقديم تجربة تفوق تطلعاتك ونقل باقة شكرك لنادين.",
      date: "2026-06-29T16:30:00.000Z",
      isVisible: true
    },
    {
      id: "rev-2",
      customer: "غادة عبد اللطيف",
      rating: 5,
      employee: "ليلى (Layla)",
      commentAr: "جلسة الهيدرافيشال لغرفة العناية الفاخرة نقلتني لعالم آخر من الاستجمام. ليلى كانت متعاونة ولطيفة جداً وتعرف مصلحة بشرتي.",
      commentEn: "The hydrafacial treatment in the luxury room took me to another world of relaxation. Layla was very helpful and knew exactly what my skin needed.",
      reply: null,
      date: "2026-06-28T10:15:00.000Z",
      isVisible: true
    },
    {
      id: "rev-3",
      customer: "أمل الخالدي",
      rating: 4,
      employee: "مريم (Maryam)",
      commentAr: "مساج الأحجار الساخنة ممتاز جداً ومريح للأعصاب. فقط تمنيت لو كانت موسيقى الخلفية في الغرفة أكثر هدوءاً بعض الشيء.",
      commentEn: "The hot stone massage is excellent and very relaxing. I only wished the background music in the spa room was slightly quieter.",
      reply: "شكراً لتقييمك وملاحظتك القيمة أمل، نعمل باستمرار على ضبط جميع تفاصيل غرف الاستجمام لتجربة مثالية.",
      date: "2026-06-27T11:45:00.000Z",
      isVisible: true
    },
    {
      id: "rev-4",
      customer: "نورة القحطاني",
      rating: 2,
      employee: "أسماء (Asma)",
      commentAr: "الخدمة كانت بطيئة للغاية، تأخرت الموظفة ١٥ دقيقة عن موعد الجلسة بالرغم من تأكيدي للحجز مسبقاً.",
      commentEn: "The service was extremely slow, the employee arrived 15 minutes late for my session despite my booking confirmation.",
      reply: null,
      date: "2026-06-26T14:10:00.000Z",
      isVisible: false
    },
    {
      id: "rev-5",
      customer: "فاطمة الدوسري",
      rating: 3,
      employee: "ليلى (Layla)",
      commentAr: "القصة كانت مقبولة ولكن لم تكن مطابقة تماماً للمثال الذي عرضته. الموظفة بحاجة للمزيد من التدريب على قصات الكاريه العصري.",
      commentEn: "The cut was acceptable but didn't look like the reference I showed. The stylist needs some more training on modern bobs.",
      reply: null,
      date: "2026-06-25T09:30:00.000Z",
      isVisible: true
    }
  ];

  // GET /api/v1/tenant/reviews
  app.get("/api/v1/tenant/reviews", (req, res) => {
    try {
      res.json(reviews);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load reviews list." });
    }
  });

  // PATCH /api/v1/tenant/reviews/:id
  app.patch("/api/v1/tenant/reviews/:id", (req, res) => {
    try {
      const { id } = req.params;
      const index = reviews.findIndex(r => r.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Review not found." });
      }

      const { isVisible, reply } = req.body;

      if (isVisible !== undefined) {
        reviews[index].isVisible = !!isVisible;
      }
      if (reply !== undefined) {
        reviews[index].reply = reply === "" ? null : reply;
      }

      res.json(reviews[index]);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update review status." });
    }
  });


  // ==========================================
  // MESSAGES & EMPLOYEES MODULE
  // ==========================================

  interface MessageReply {
    id: string;
    senderNameAr: string;
    senderNameEn: string;
    senderRoleAr: string;
    senderRoleEn: string;
    senderAvatar: string;
    body: string;
    timestamp: string;
  }

  interface MessageAttachment {
    name: string;
    size: string;
    type: string;
  }

  interface RecipientStatus {
    employeeId: string;
    nameAr: string;
    nameEn: string;
    roleAr: string;
    roleEn: string;
    avatar: string;
    status: 'read' | 'unread';
    readTime?: string;
    deliveredTime?: string;
  }

  interface MessageThread {
    id: string;
    senderNameAr: string;
    senderNameEn: string;
    senderRoleAr: string;
    senderRoleEn: string;
    senderAvatar: string;
    titleAr: string;
    titleEn: string;
    body: string;
    timestamp: string;
    isPinned: boolean;
    isArchived: boolean;
    category: string;
    unread: boolean;
    unreadCount: number;
    recipientType: 'all_staff' | 'employee' | 'unknown';
    recipientNameAr?: string;
    recipientNameEn?: string;
    replies: MessageReply[];
    attachments?: MessageAttachment[];
    recipientStatuses?: RecipientStatus[];
  }

  interface StaffMember {
    id: string;
    nameAr: string;
    nameEn: string;
    roleAr: string;
    roleEn: string;
    avatar: string;
  }

  const backendStaffMembers: StaffMember[] = [
    { id: 'st-1', nameAr: 'أحمد الحارثي', nameEn: 'Ahmad Al-Harthi', roleAr: 'مدير عام الفرع', roleEn: 'General Manager', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
    { id: 'st-2', nameAr: 'سارة الأحمد', nameEn: 'Sarah Al-Ahmad', roleAr: 'مشرفة قسم الاسترخاء', roleEn: 'Spa Supervisor', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
    { id: 'st-3', nameAr: 'ريم الدوسري', nameEn: 'Reem Al-Dossari', roleAr: 'مسؤولة الاستقبال الفخم', roleEn: 'Prestige Receptionist', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80' },
    { id: 'st-4', nameAr: 'نورة السليمان', nameEn: 'Noura Al-Sulaiman', roleAr: 'خبير التصفيف الملكي', roleEn: 'Royal Stylist', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80' },
    { id: 'st-5', nameAr: 'خالد العنزي', nameEn: 'Khalid Al-Anazi', roleAr: 'المدير المالي للمنشأة', roleEn: 'Finance Director', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' }
  ];

  let backendMessages: MessageThread[] = [
    {
      id: 'msg-1',
      senderNameAr: 'أحمد الحارثي',
      senderNameEn: 'Ahmad Al-Harthi',
      senderRoleAr: 'مدير عام الفرع',
      senderRoleEn: 'General Manager',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      titleAr: 'تحديثات هامة حول باقات العناية الملكية لـ VIP',
      titleEn: 'Important updates regarding Royal VIP Care packages',
      body: 'الزملاء الأعزاء، تم تحديث أسعار وتفاصيل باقة الـ VIP الملكية للتوافق مع تطلعات ضيوفنا للموسم الجديد. يرجى مراجعة الملف المرفق وإبلاغ الضيوف فوراً بخصوص الخصم.',
      timestamp: '10:30 AM',
      isPinned: true,
      isArchived: false,
      category: 'broadcast',
      unread: true,
      unreadCount: 3,
      recipientType: 'all_staff',
      replies: [
        {
          id: 'rep-1',
          senderNameAr: 'ريم الدوسري',
          senderNameEn: 'Reem Al-Dossari',
          senderRoleAr: 'مسؤولة الاستقبال',
          senderRoleEn: 'Prestige Receptionist',
          senderAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
          body: 'تم استلام التعميم وسأقوم بمراجعة جميع الحجوزات القادمة وتحديث الباقة في النظام تلقائياً.',
          timestamp: '10:45 AM'
        }
      ],
      attachments: [
        { name: 'Royal_VIP_Pricing_2026.pdf', size: '1.4 MB', type: 'pdf' }
      ],
      recipientStatuses: [
        { employeeId: 'st-2', nameAr: 'سارة الأحمد', nameEn: 'Sarah Al-Ahmad', roleAr: 'مشرفة قسم الاسترخاء', roleEn: 'Spa Supervisor', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', status: 'read', readTime: '10:35 AM', deliveredTime: '10:30 AM' },
        { employeeId: 'st-3', nameAr: 'ريم الدوسري', nameEn: 'Reem Al-Dossari', roleAr: 'مسؤولة الاستقبال الفخم', roleEn: 'Prestige Receptionist', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80', status: 'read', readTime: '10:45 AM', deliveredTime: '10:30 AM' },
        { employeeId: 'st-4', nameAr: 'نورة السليمان', nameEn: 'Noura Al-Sulaiman', roleAr: 'خبير التصفيف الملكي', roleEn: 'Royal Stylist', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80', status: 'unread', deliveredTime: '10:30 AM' },
        { employeeId: 'st-5', nameAr: 'خالد العنزي', nameEn: 'Khalid Al-Anazi', roleAr: 'المدير المالي للمنشأة', roleEn: 'Finance Director', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', status: 'read', readTime: '11:00 AM', deliveredTime: '10:30 AM' }
      ]
    },
    {
      id: 'msg-2',
      senderNameAr: 'سارة الأحمد',
      senderNameEn: 'Sarah Al-Ahmad',
      senderRoleAr: 'مشرفة قسم الاسترخاء',
      senderRoleEn: 'Spa Supervisor',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
      titleAr: 'جرد أجهزة التدليك وزيوت العناية بالبشرة',
      titleEn: 'Spa Massage Oils and Device Inventory Audit',
      body: 'يرجى من جميع المختصين في قسم الاسترخاء إكمال جرد زيوت اللافندر والمسك الملكي قبل نهاية الوردية اليوم لتجنب أي نقص في الجلسات القادمة.',
      timestamp: '9:15 AM',
      isPinned: false,
      isArchived: false,
      category: 'dm',
      unread: false,
      unreadCount: 0,
      recipientType: 'employee',
      recipientNameAr: 'أحمد الحارثي',
      recipientNameEn: 'Ahmad Al-Harthi',
      replies: [],
      recipientStatuses: [
        { employeeId: 'st-1', nameAr: 'أحمد الحارثي', nameEn: 'Ahmad Al-Harthi', roleAr: 'مدير عام الفرع', roleEn: 'General Manager', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', status: 'read', readTime: '9:20 AM', deliveredTime: '9:15 AM' }
      ]
    },
    {
      id: 'msg-3',
      senderNameAr: 'تنبيه النظام (بث تلقائي)',
      senderNameEn: 'System Broadcast (Automated)',
      senderRoleAr: 'مراقب الخادم',
      senderRoleEn: 'Server Agent',
      senderAvatar: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=150&q=80',
      titleAr: 'معدل الحجوزات تجاوز المستهدف الأسبوعي بنسبة ١٥٪ 🎉',
      titleEn: 'Weekly reservation target exceeded by 15% 🎉',
      body: 'تهانينا لطاقم عمل رفاه الفاخر! بفضل جهودكم في الترويج للعروض الساخنة وتقديم الخدمة الاستثنائية، حققنا أعلى معدل حجز للأسبوع الحالي.',
      timestamp: 'Yesterday',
      isPinned: true,
      isArchived: false,
      category: 'broadcast',
      unread: true,
      unreadCount: 5,
      recipientType: 'all_staff',
      replies: [],
      recipientStatuses: [
        { employeeId: 'st-1', nameAr: 'أحمد الحارثي', nameEn: 'Ahmad Al-Harthi', roleAr: 'مدير عام الفرع', roleEn: 'General Manager', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', status: 'read', readTime: 'Yesterday 8:05 AM', deliveredTime: 'Yesterday 8:00 AM' },
        { employeeId: 'st-2', nameAr: 'سارة الأحمد', nameEn: 'Sarah Al-Ahmad', roleAr: 'مشرفة قسم الاسترخاء', roleEn: 'Spa Supervisor', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', status: 'read', readTime: 'Yesterday 8:12 AM', deliveredTime: 'Yesterday 8:00 AM' },
        { employeeId: 'st-3', nameAr: 'ريم الدوسري', nameEn: 'Reem Al-Dossari', roleAr: 'مسؤولة الاستقبال الفخم', roleEn: 'Prestige Receptionist', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80', status: 'read', readTime: 'Yesterday 8:30 AM', deliveredTime: 'Yesterday 8:00 AM' },
        { employeeId: 'st-4', nameAr: 'نورة السليمان', nameEn: 'Noura Al-Sulaiman', roleAr: 'خبير التصفيف الملكي', roleEn: 'Royal Stylist', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80', status: 'unread', deliveredTime: 'Yesterday 8:00 AM' },
        { employeeId: 'st-5', nameAr: 'خالد العنزي', nameEn: 'Khalid Al-Anazi', roleAr: 'المدير المالي للمنشأة', roleEn: 'Finance Director', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', status: 'unread', deliveredTime: 'Yesterday 8:00 AM' }
      ]
    },
    {
      id: 'msg-4',
      senderNameAr: 'خالد العنزي',
      senderNameEn: 'Khalid Al-Anazi',
      senderRoleAr: 'المدير المالي للمنشأة',
      senderRoleEn: 'Finance Director',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      titleAr: 'فواتير المصروفات النثرية والتشغيلية لشهر يونيو',
      titleEn: 'Submission of June operational invoices',
      body: 'الرجاء رفع جميع فواتير الشراء الخاصة بمستلزمات الصالون النثرية في موعد أقصاه الخميس القادم للتسوية المالية وإغلاق الربع المالي.',
      timestamp: '2 days ago',
      isPinned: false,
      isArchived: false,
      category: 'dm',
      unread: false,
      unreadCount: 0,
      recipientType: 'employee',
      recipientNameAr: 'نورة السليمان',
      recipientNameEn: 'Noura Al-Sulaiman',
      replies: [],
      recipientStatuses: [
        { employeeId: 'st-4', nameAr: 'نورة السليمان', nameEn: 'Noura Al-Sulaiman', roleAr: 'خبير التصفيف الملكي', roleEn: 'Royal Stylist', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80', status: 'unread', deliveredTime: '2 days ago' }
      ]
    },
    {
      id: 'msg-5',
      senderNameAr: 'عضو طاقم سابق (مستقيل)',
      senderNameEn: 'Former Staff Member (Resigned)',
      senderRoleAr: 'غير معروف',
      senderRoleEn: 'Unknown Role',
      senderAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      titleAr: 'مستودع الملحقات والإكسسوارات الملكية المفقودة',
      titleEn: 'Royal accessories lost & found storage report',
      body: 'لقد تم تجميع بعض الإكسسوارات المفقودة من الجناح رقم ٤ وتسليمها للأمانات. يرجى المتابعة.',
      timestamp: '3 days ago',
      isPinned: false,
      isArchived: false,
      category: 'inbox',
      unread: true,
      unreadCount: 1,
      recipientType: 'unknown',
      replies: [],
      recipientStatuses: []
    },
    {
      id: 'msg-6',
      senderNameAr: 'نورة السليمان',
      senderNameEn: 'Noura Al-Sulaiman',
      senderRoleAr: 'خبير التصفيف الملكي',
      senderRoleEn: 'Royal Stylist',
      senderAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
      titleAr: 'طلب إجازة قصيرة يوم الخميس القادم لظرف عائلي',
      titleEn: 'Request for emergency personal leave next Thursday',
      body: 'أهلاً أحمد، أود تقديم طلب إجازة قصيرة ليوم الخميس القادم لظروف عائلية طارئة. لقد نسقت مع ناتاشا لتغطية حجوزات قص الشعر والصبغ.',
      timestamp: '4 days ago',
      isPinned: false,
      isArchived: true,
      category: 'dm',
      unread: false,
      unreadCount: 0,
      recipientType: 'employee',
      recipientNameAr: 'أحمد الحارثي',
      recipientNameEn: 'Ahmad Al-Harthi',
      replies: [],
      recipientStatuses: [
        { employeeId: 'st-1', nameAr: 'أحمد الحارثي', nameEn: 'Ahmad Al-Harthi', roleAr: 'مدير عام الفرع', roleEn: 'General Manager', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', status: 'read', readTime: '4 days ago', deliveredTime: '4 days ago' }
      ]
    }
  ];

  // GET /api/v1/tenant/messages
  app.get("/api/v1/tenant/messages", (req, res) => {
    try {
      res.json(backendMessages);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load messages." });
    }
  });

  // GET /api/v1/tenant/employees
  app.get("/api/v1/tenant/employees", (req, res) => {
    try {
      res.json(backendStaffMembers);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load employees." });
    }
  });

  // POST /api/v1/tenant/messages
  app.post("/api/v1/tenant/messages", (req, res) => {
    try {
      const message = req.body;
      if (!message || !message.body) {
        return res.status(400).json({ error: "Message context/body is required." });
      }

      const newMsg = {
        ...message,
        id: message.id || `msg-${Date.now()}`
      };

      backendMessages.unshift(newMsg);
      res.status(201).json(newMsg);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save message." });
    }
  });

  // DELETE /api/v1/tenant/messages/:id
  app.delete("/api/v1/tenant/messages/:id", (req, res) => {
    try {
      const { id } = req.params;
      const idx = backendMessages.findIndex(m => m.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: "Message not found." });
      }
      backendMessages.splice(idx, 1);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete message." });
    }
  });

  // PUT /api/v1/tenant/messages/:id
  app.put("/api/v1/tenant/messages/:id", (req, res) => {
    try {
      const { id } = req.params;
      const updatedMessage = req.body;
      const idx = backendMessages.findIndex(m => m.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: "Message not found." });
      }
      backendMessages[idx] = {
        ...backendMessages[idx],
        ...updatedMessage
      };
      res.json(backendMessages[idx]);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update message." });
    }
  });

  // ==========================================
  // REFAH CRM CUSTOMERS MODULE
  // ==========================================

  interface BackendCustomer {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    nameAr: string;
    email: string;
    phone: string;
    isWalkIn: boolean;
    customerType: 'walk_in' | 'service_only' | 'product_only' | 'both';
    totalBookings: number;
    noShowCount: number;
    totalOrders: number;
    productsPurchased: number;
    totalSpent: number;
    loyaltyTier: 'VIP Royal' | 'Gold Star' | 'Silver Star' | 'First-Timer';
    lastVisit: string;
    memberSince: string;
    birthdate?: string;
    assignedStylist?: string;
    assignedStylistAr?: string;
    spentServices?: number;
    spentProducts?: number;
    avgTicket?: number;
    unpaidBalance?: number;
    prefDrink?: string;
    prefDrinkAr?: string;
    prefTemp?: string;
    prefTempAr?: string;
    prefChat?: string;
    prefChatAr?: string;
    allergies?: string;
    allergiesAr?: string;
    favServices?: string[];
    favServicesAr?: string[];
    notes?: string[];
    tags?: string[];
    gender?: string;
    preferredLanguage?: string;
    walletBalance?: number;
    walletCashback?: number;
    loyaltyPoints?: number;
    completedBookings?: number;
    favProducts?: string[];
    favProductsAr?: string[];
    preferredDeliveryType?: string;
    preferredDeliveryTypeAr?: string;
    giftCardsSent?: number;
    giftCardsReceived?: number;
    walletEntriesCount?: number;
  }

  const backendCustomers: BackendCustomer[] = [
    {
      id: "CUST-001",
      firstName: "Sarah",
      lastName: "Abdullah",
      name: "Sarah Abdullah",
      nameAr: "سارة عبد الله",
      email: "sarah.a@gmail.com",
      phone: "+966 50 123 4567",
      isWalkIn: false,
      customerType: "both",
      totalBookings: 14,
      noShowCount: 0,
      totalOrders: 6,
      productsPurchased: 4,
      totalSpent: 3840,
      loyaltyTier: "Silver Star",
      lastVisit: "2026-06-20",
      memberSince: "2025-02-10",
      birthdate: "1998-11-04",
      assignedStylist: "Elena Vasily",
      assignedStylistAr: "إيلينا فاسيلي",
      spentServices: 3420,
      spentProducts: 420,
      avgTicket: 274,
      unpaidBalance: 150,
      prefDrink: "Black Tea, light mint",
      prefDrinkAr: "شاي أحمر خفيف بالنعناع",
      prefTemp: "Warm temperature preferences",
      prefTempAr: "تفضل بيئة غرف دافئة",
      prefChat: "Polite and moderate",
      prefChatAr: "مهذبة ومتوسطة الحديث",
      allergies: "Sensitive eyes during lash treatment",
      allergiesAr: "عيون حساسة عند تركيب الرموش أو المواد المخصصة له",
      favServices: ["Gel Extension & Chrome Polish", "Royal Hydra-Facial & Glow"],
      favServicesAr: ["تركيب جل مع طلاء كروم", "هيدرافيشال ملكي ونضارة"],
      notes: ["Needs extra care on left hand fingernails."],
      tags: ["Silver Star", "Nails Regular"]
    },
    {
      id: "CUST-002",
      firstName: "Maha",
      lastName: "Al-Shammari",
      name: "Maha Al-Shammari",
      nameAr: "مها الشمري",
      email: "maha.sh@hotmail.com",
      phone: "+966 54 876 5432",
      isWalkIn: false,
      customerType: "service_only",
      totalBookings: 8,
      noShowCount: 1,
      totalOrders: 3,
      productsPurchased: 0,
      totalSpent: 2450,
      loyaltyTier: "Silver Star",
      lastVisit: "2026-06-25",
      memberSince: "2026-06-01",
      birthdate: "1997-03-14",
      assignedStylist: "Layla Al-Asiri",
      assignedStylistAr: "ليلى العسيري",
      spentServices: 2450,
      spentProducts: 0,
      avgTicket: 306,
      unpaidBalance: 0,
      prefDrink: "Turkish Coffee, no sugar",
      prefDrinkAr: "قهوة تركية، سادة",
      prefTemp: "Cool temperature",
      prefTempAr: "درجة حرارة باردة للغرفة",
      prefChat: "Quiet and calm",
      prefChatAr: "تفضل الهدوء والسكينة",
      allergies: "None",
      allergiesAr: "لا توجد أي حساسية مسجلة",
      favServices: ["Royal Swedish Massage"],
      favServicesAr: ["جلسة مساج السويدي الملكي"],
      notes: ["Prefers female therapists only."],
      tags: ["Silver Star", "Spa Regular"]
    },
    {
      id: "CUST-003",
      firstName: "Arwa",
      lastName: "Al-Otaibi",
      name: "Arwa Al-Otaibi",
      nameAr: "أروى العتيبي",
      email: "arwa.beauty@yahoo.com",
      phone: "+966 56 345 6789",
      isWalkIn: false,
      customerType: "both",
      totalBookings: 22,
      noShowCount: 1,
      totalOrders: 10,
      productsPurchased: 3,
      totalSpent: 7120,
      loyaltyTier: "Gold Star",
      lastVisit: "2026-06-27",
      memberSince: "2024-06-18",
      birthdate: "1995-09-22",
      assignedStylist: "Layla Al-Asiri",
      assignedStylistAr: "ليلى العسيري",
      spentServices: 6500,
      spentProducts: 620,
      avgTicket: 323,
      unpaidBalance: 0,
      prefDrink: "iced Americano with almond milk",
      prefDrinkAr: "آيس أمريكانو مع حليب اللوز",
      prefTemp: "Moderate room temperature",
      prefTempAr: "درجة حرارة معتدلة ومتوازنة للغرفة",
      prefChat: "Extremely talkative & cheerful",
      prefChatAr: "اجتماعية ومرحة، تحب تبادل أطراف الحديث",
      allergies: "None recorded",
      allergiesAr: "لا توجد أي حساسية مسجلة",
      favServices: ["Royal Swedish Massage", "Platinum Hydrafacial"],
      favServicesAr: ["جلسة مساج السويدي الملكي", "تنظيف بشرة هيدرافيشال بلاتينيوم"],
      notes: ["Always books Spa therapists specifically.", "Dislikes heavy floral perfume scents."],
      tags: ["Gold Star", "Spa Enthusiast", "Friendly"]
    },
    {
      id: "CUST-004",
      firstName: "Fatimah",
      lastName: "Al-Dossary",
      name: "Fatimah Al-Dossary",
      nameAr: "فاطمة الدوسري",
      email: "fatimah.d@outlook.com",
      phone: "+966 55 987 6543",
      isWalkIn: false,
      customerType: "both",
      totalBookings: 3,
      noShowCount: 0,
      totalOrders: 2,
      productsPurchased: 1,
      totalSpent: 950,
      loyaltyTier: "First-Timer",
      lastVisit: "2026-05-18",
      memberSince: "2026-05-15",
      birthdate: "1999-07-30",
      assignedStylist: "Nadeen Al-Harbi",
      assignedStylistAr: "نادين الحربي",
      spentServices: 750,
      spentProducts: 200,
      avgTicket: 316,
      unpaidBalance: 0,
      prefDrink: "Green Tea",
      prefDrinkAr: "شاي أخضر طبيعي",
      prefTemp: "Standard",
      prefTempAr: "معتدل",
      prefChat: "Moderate",
      prefChatAr: "معتدل",
      allergies: "None",
      allergiesAr: "لا توجد",
      favServices: ["Blowdry Luxury Session"],
      favServicesAr: ["غسيل وتسريح بريميوم"],
      notes: ["Requires non-silicon shampoo."],
      tags: ["First-Timer", "Shampoo Sensitive"]
    },
    {
      id: "CUST-005",
      firstName: "Najla",
      lastName: "Al-Saud",
      name: "Najla Al-Saud",
      nameAr: "نجلاء آل سعود",
      email: "najla.as@vip.gov.sa",
      phone: "+966 50 999 8888",
      isWalkIn: false,
      customerType: "both",
      totalBookings: 45,
      noShowCount: 0,
      totalOrders: 18,
      productsPurchased: 8,
      totalSpent: 18600,
      loyaltyTier: "VIP Royal",
      lastVisit: "2026-06-26",
      memberSince: "2024-01-15",
      birthdate: "1992-04-12",
      assignedStylist: "Nadeen Al-Harbi",
      assignedStylistAr: "نادين الحربي",
      spentServices: 15400,
      spentProducts: 3200,
      avgTicket: 413,
      unpaidBalance: 0,
      prefDrink: "Turkish Coffee, zero sugar",
      prefDrinkAr: "قهوة تركية، سادة بدون سكر",
      prefTemp: "Cool and dim lighting",
      prefTempAr: "غرفة باردة مع إضاءة خافتة للاسترخاء",
      prefChat: "Prefers quiet serene style",
      prefChatAr: "تفضل الصمت والهدوء التام دون ثرثرة",
      allergies: "Hair dye formulas with ammonia & PPD",
      allergiesAr: "حساسية من صبغات الشعر التي تحتوي على الأمونيا",
      favServices: ["Balayage & Premium Styling", "Royal Hydra-Facial & Glow"],
      favServicesAr: ["بالياج مع تسريح بريميوم", "هيدرافيشال ملكي ونضارة"],
      notes: ["Prefers exclusive service room in the East Wing.", "Always serves with low-sugar options.", "Do not offer third-party standard cosmetic products."],
      tags: ["VIP Royal", "Color Regular", "Spends High", "Coffee Lover"]
    },
    {
      id: "CUST-006",
      firstName: "Reem",
      lastName: "Al-Faisal",
      name: "Reem Al-Faisal",
      nameAr: "ريم الفيصل",
      email: "reem.faisal@vip.gov.sa",
      phone: "+966 50 888 7777",
      isWalkIn: false,
      customerType: "both",
      totalBookings: 32,
      noShowCount: 0,
      totalOrders: 12,
      productsPurchased: 5,
      totalSpent: 11200,
      loyaltyTier: "VIP Royal",
      lastVisit: "2026-06-29",
      memberSince: "2024-11-20",
      birthdate: "1994-08-18",
      assignedStylist: "Nadeen Al-Harbi",
      assignedStylistAr: "نادين الحربي",
      spentServices: 9500,
      spentProducts: 1700,
      avgTicket: 350,
      unpaidBalance: 0,
      prefDrink: "Chilled Saffron Latte",
      prefDrinkAr: "سافرون لاتيه مبرد فاخر",
      prefTemp: "Moderate",
      prefTempAr: "معتدل",
      prefChat: "Quiet",
      prefChatAr: "تفضل الهدوء التام",
      allergies: "Peanut extract in hair oils",
      allergiesAr: "حساسية من زيت الفول السوداني في منتجات الشعر",
      favServices: ["Olaplex Rejuvenation", "Nail Polish Deluxe"],
      favServicesAr: ["جلسة علاج أولابليكس للشعر", "طلاء أظافر ديلوكس"],
      notes: ["Very specific color codes for nails."],
      tags: ["VIP Royal", "Color Regular", "Peanut Allergy"]
    },
    {
      id: "CUST-007",
      firstName: "Alanoud",
      lastName: "Al-Subaie",
      name: "Alanoud Al-Subaie",
      nameAr: "العنود السبيعي",
      email: "alanoud.subaie@gmail.com",
      phone: "+966 55 432 1098",
      isWalkIn: true,
      customerType: "walk_in",
      totalBookings: 1,
      noShowCount: 0,
      totalOrders: 1,
      productsPurchased: 0,
      totalSpent: 350,
      loyaltyTier: "First-Timer",
      lastVisit: "2026-06-29",
      memberSince: "2026-06-29",
      birthdate: "1996-12-05",
      assignedStylist: "Layla Al-Asiri",
      assignedStylistAr: "ليلى العسيري",
      spentServices: 350,
      spentProducts: 0,
      avgTicket: 350,
      unpaidBalance: 0,
      prefDrink: "Water",
      prefDrinkAr: "ماء فاتر",
      prefTemp: "Standard",
      prefTempAr: "معتدل",
      prefChat: "Moderate",
      prefChatAr: "معتدل",
      allergies: "None",
      allergiesAr: "لا توجد",
      favServices: [],
      favServicesAr: [],
      notes: ["Walk-in client registered at front desk."],
      tags: ["First-Timer", "Walk-In"]
    },
    {
      id: "CUST-008",
      firstName: "Ghadah",
      lastName: "Al-Shehri",
      name: "Ghadah Al-Shehri",
      nameAr: "غادة الشهري",
      email: "ghadah.shehri@yahoo.com",
      phone: "+966 53 111 2222",
      isWalkIn: false,
      customerType: "service_only",
      totalBookings: 7,
      noShowCount: 0,
      totalOrders: 3,
      productsPurchased: 0,
      totalSpent: 1850,
      loyaltyTier: "Silver Star",
      lastVisit: "2026-06-15",
      memberSince: "2025-08-01",
      birthdate: "1991-02-28",
      assignedStylist: "Elena Vasily",
      assignedStylistAr: "إيلينا فاسيلي",
      spentServices: 1850,
      spentProducts: 0,
      avgTicket: 264,
      unpaidBalance: 0,
      prefDrink: "Espresso",
      prefDrinkAr: "إسبريسو سينجل",
      prefTemp: "Cool",
      prefTempAr: "بارد للغرفة",
      prefChat: "Chatty",
      prefChatAr: "تفضل الأحاديث الودية",
      allergies: "None",
      allergiesAr: "لا توجد",
      favServices: ["Manicure Deluxe"],
      favServicesAr: ["باديكير مانيكير ديلوكس"],
      notes: [],
      tags: ["Silver Star", "Nail Lover"]
    },
    {
      id: "CUST-009",
      firstName: "Nouf",
      lastName: "Al-Qahtani",
      name: "Nouf Al-Qahtani",
      nameAr: "نوف القحطاني",
      email: "nouf.qahtani@outlook.com",
      phone: "+966 54 222 3333",
      isWalkIn: false,
      customerType: "product_only",
      totalBookings: 0,
      noShowCount: 0,
      totalOrders: 2,
      productsPurchased: 5,
      totalSpent: 850,
      loyaltyTier: "First-Timer",
      lastVisit: "2026-05-12",
      memberSince: "2026-05-10",
      birthdate: "1993-05-15",
      assignedStylist: "Nadeen Al-Harbi",
      assignedStylistAr: "نادين الحربي",
      spentServices: 0,
      spentProducts: 850,
      avgTicket: 425,
      unpaidBalance: 0,
      prefDrink: "Water, chilled",
      prefDrinkAr: "ماء بارد",
      prefTemp: "Standard",
      prefTempAr: "معتدل",
      prefChat: "Quiet",
      prefChatAr: "هدوء",
      allergies: "None",
      allergiesAr: "لا توجد",
      favServices: [],
      favServicesAr: [],
      notes: ["Purchases luxury brand hair creams only."],
      tags: ["First-Timer", "Product Only"]
    },
    {
      id: "CUST-010",
      firstName: "Hessa",
      lastName: "Al-Sudairy",
      name: "Hessa Al-Sudairy",
      nameAr: "حصة السديري",
      email: "hessa.sud@vip.gov.sa",
      phone: "+966 50 777 6666",
      isWalkIn: false,
      customerType: "both",
      totalBookings: 50,
      noShowCount: 2,
      totalOrders: 20,
      productsPurchased: 12,
      totalSpent: 22000,
      loyaltyTier: "VIP Royal",
      lastVisit: "2026-06-28",
      memberSince: "2023-04-01",
      birthdate: "1988-10-12",
      assignedStylist: "Nadeen Al-Harbi",
      assignedStylistAr: "نادين الحربي",
      spentServices: 18500,
      spentProducts: 3500,
      avgTicket: 440,
      unpaidBalance: 0,
      prefDrink: "Arabic Coffee with Cardamom",
      prefDrinkAr: "قهوة عربية بالهيل والزعفران",
      prefTemp: "Warm",
      prefTempAr: "بيئة غرف دافئة مع بخور العود الملائم",
      prefChat: "Serene & Dignified",
      prefChatAr: "صمت وتوقير",
      allergies: "Highly sensitive skin",
      allergiesAr: "بشرة حساسة للمستحضرات الكيميائية الثقيلة",
      favServices: ["Olaplex Rejuvenation", "Royal Swedish Massage", "Deluxe Facial"],
      favServicesAr: ["علاج تجديد روابط الشعر أولابليكس", "جلسة مساج السويدي الملكي", "تنظيف بشرة ملكي بالذهب"],
      notes: ["Must burn premium agarwood incense before her arrival.", "Always reserves the private VVIP suite."],
      tags: ["VIP Royal", "VVIP Suite", "Agarwood Incense"]
    },
    {
      id: "CUST-011",
      firstName: "Bashayer",
      lastName: "Al-Harbi",
      name: "Bashayer Al-Harbi",
      nameAr: "بشاير الحربي",
      email: "bashayer.h@gmail.com",
      phone: "+966 55 123 9876",
      isWalkIn: false,
      customerType: "service_only",
      totalBookings: 15,
      noShowCount: 0,
      totalOrders: 4,
      productsPurchased: 0,
      totalSpent: 4500,
      loyaltyTier: "Gold Star",
      lastVisit: "2026-06-18",
      memberSince: "2025-01-20",
      birthdate: "1992-06-30",
      assignedStylist: "Elena Vasily",
      assignedStylistAr: "إيلينا فاسيلي",
      spentServices: 4500,
      spentProducts: 0,
      avgTicket: 300,
      unpaidBalance: 0,
      prefDrink: "Iced Caramel Macchiato",
      prefDrinkAr: "كاراميل ماكياتو مبرد",
      prefTemp: "Standard",
      prefTempAr: "افتراضي",
      prefChat: "Talkative",
      prefChatAr: "اجتماعية ومرحة",
      allergies: "None",
      allergiesAr: "لا توجد",
      favServices: ["Nail Polish Deluxe", "Platinum Hydrafacial"],
      favServicesAr: ["طلاء أظافر ديلوكس", "تنظيف بشرة هيدرافيشال بلاتينيوم"],
      notes: [],
      tags: ["Gold Star"]
    },
    {
      id: "CUST-012",
      firstName: "Yara",
      lastName: "Al-Malki",
      name: "Yara Al-Malki",
      nameAr: "يارا المالكي",
      email: "yara.malki@yahoo.com",
      phone: "+966 56 888 1234",
      isWalkIn: true,
      customerType: "walk_in",
      totalBookings: 2,
      noShowCount: 0,
      totalOrders: 1,
      productsPurchased: 0,
      totalSpent: 700,
      loyaltyTier: "First-Timer",
      lastVisit: "2026-06-11",
      memberSince: "2026-06-05",
      birthdate: "1998-03-22",
      assignedStylist: "Layla Al-Asiri",
      assignedStylistAr: "ليلى العسيري",
      spentServices: 700,
      spentProducts: 0,
      avgTicket: 350,
      unpaidBalance: 0,
      prefDrink: "Cold Water",
      prefDrinkAr: "ماء بارد",
      prefTemp: "Moderate",
      prefTempAr: "معتدل",
      prefChat: "Moderate",
      prefChatAr: "معتدل",
      allergies: "None",
      allergiesAr: "لا توجد",
      favServices: ["Blowdry Luxury Session"],
      favServicesAr: ["غسيل وتسريح بريميوم"],
      notes: [],
      tags: ["First-Timer", "Walk-In"]
    },
    {
      id: "CUST-013",
      firstName: "Kholoud",
      lastName: "Al-Enazi",
      name: "Kholoud Al-Enazi",
      nameAr: "خلود العنزي",
      email: "kholoud.enazi@gmail.com",
      phone: "+966 54 999 5555",
      isWalkIn: false,
      customerType: "both",
      totalBookings: 18,
      noShowCount: 1,
      totalOrders: 8,
      productsPurchased: 4,
      totalSpent: 6200,
      loyaltyTier: "Gold Star",
      lastVisit: "2026-06-24",
      memberSince: "2024-09-12",
      birthdate: "1990-11-14",
      assignedStylist: "Elena Vasily",
      assignedStylistAr: "إيلينا فاسيلي",
      spentServices: 5200,
      spentProducts: 1000,
      avgTicket: 344,
      unpaidBalance: 0,
      prefDrink: "Spanish Latte",
      prefDrinkAr: "سبانيش لاتيه مبرد",
      prefTemp: "Cool",
      prefTempAr: "درجة حرارة باردة",
      prefChat: "Quiet",
      prefChatAr: "هادئة",
      allergies: "Lanolin sensitive",
      allergiesAr: "حساسية من مادة اللانولين في كريمات الترطيب",
      favServices: ["Manicure Deluxe", "Balayage & Premium Styling"],
      favServicesAr: ["باديكير مانيكير ديلوكس", "بالياج مع تسريح بريميوم"],
      notes: ["Lanolin-free moisturizer products only."],
      tags: ["Gold Star", "Lanolin Sensitive"]
    },
    {
      id: "CUST-014",
      firstName: "Afnan",
      lastName: "Al-Ghamdi",
      name: "Afnan Al-Ghamdi",
      nameAr: "أفنان الغامدي",
      email: "afnan.ghamdi@outlook.com",
      phone: "+966 53 777 1111",
      isWalkIn: false,
      customerType: "service_only",
      totalBookings: 6,
      noShowCount: 0,
      totalOrders: 2,
      productsPurchased: 0,
      totalSpent: 2100,
      loyaltyTier: "Silver Star",
      lastVisit: "2026-06-03",
      memberSince: "2026-06-01",
      birthdate: "1995-04-18",
      assignedStylist: "Layla Al-Asiri",
      assignedStylistAr: "ليلى العسيري",
      spentServices: 2100,
      spentProducts: 0,
      avgTicket: 350,
      unpaidBalance: 0,
      prefDrink: "Black Coffee",
      prefDrinkAr: "قهوة سوداء ساخنة",
      prefTemp: "Standard",
      prefTempAr: "افتراضي",
      prefChat: "Moderate",
      prefChatAr: "معتدل",
      allergies: "None",
      allergiesAr: "لا توجد",
      favServices: ["Royal Swedish Massage"],
      favServicesAr: ["جلسة مساج السويدي الملكي"],
      notes: [],
      tags: ["Silver Star", "New in June"]
    },
    {
      id: "CUST-015",
      firstName: "Jawaher",
      lastName: "Al-Humaid",
      name: "Jawaher Al-Humaid",
      nameAr: "جواهر الحميد",
      email: "jawaher.hum@vip.gov.sa",
      phone: "+966 50 111 9999",
      isWalkIn: false,
      customerType: "both",
      totalBookings: 28,
      noShowCount: 0,
      totalOrders: 11,
      productsPurchased: 6,
      totalSpent: 9800,
      loyaltyTier: "VIP Royal",
      lastVisit: "2026-06-25",
      memberSince: "2025-03-10",
      birthdate: "1989-08-25",
      assignedStylist: "Nadeen Al-Harbi",
      assignedStylistAr: "نادين الحربي",
      spentServices: 8200,
      spentProducts: 1600,
      avgTicket: 350,
      unpaidBalance: 0,
      prefDrink: "Premium Green Tea with Jasmine",
      prefDrinkAr: "شاي أخضر بالياسمين طبيعي فاخر",
      prefTemp: "Moderate",
      prefTempAr: "معتدل",
      prefChat: "Quiet",
      prefChatAr: "هدوء وسكينة تامة",
      allergies: "None",
      allergiesAr: "لا توجد",
      favServices: ["Platinum Hydrafacial", "Balayage & Premium Styling"],
      favServicesAr: ["تنظيف بشرة هيدرافيشال بلاتينيوم", "بالياج مع تسريح بريميوم"],
      notes: ["Prefers her personal salon robe and slipper set."],
      tags: ["VIP Royal", "Premium Service"]
    },
    // Adding 20 more records to satisfy full browse listing (35 total) and pagination testing!
    { id: "CUST-016", firstName: "Layan", lastName: "Al-Zahrani", name: "Layan Al-Zahrani", nameAr: "ليان الزهراني", email: "layan.z@gmail.com", phone: "+966 55 444 3333", isWalkIn: false, customerType: "service_only", totalBookings: 5, noShowCount: 0, totalOrders: 2, productsPurchased: 0, totalSpent: 1200, loyaltyTier: "Silver Star", lastVisit: "2026-06-12", memberSince: "2025-10-05" },
    { id: "CUST-017", firstName: "Abeer", lastName: "Al-Masoud", name: "Abeer Al-Masoud", nameAr: "عبير المسعود", email: "abeer.m@gmail.com", phone: "+966 56 122 3445", isWalkIn: false, customerType: "both", totalBookings: 11, noShowCount: 0, totalOrders: 5, productsPurchased: 2, totalSpent: 3100, loyaltyTier: "Silver Star", lastVisit: "2026-06-19", memberSince: "2025-05-15" },
    { id: "CUST-018", firstName: "Shaza", lastName: "Al-Olayan", name: "Shaza Al-Olayan", nameAr: "شذى العليان", email: "shaza.o@outlook.com", phone: "+966 53 555 1212", isWalkIn: false, customerType: "product_only", totalBookings: 0, noShowCount: 0, totalOrders: 4, productsPurchased: 9, totalSpent: 1950, loyaltyTier: "First-Timer", lastVisit: "2026-05-30", memberSince: "2026-01-20" },
    { id: "CUST-019", firstName: "Wafa", lastName: "Al-Saeed", name: "Wafa Al-Saeed", nameAr: "وفاء السعيد", email: "wafa.saeed@yahoo.com", phone: "+966 54 333 4444", isWalkIn: true, customerType: "walk_in", totalBookings: 1, noShowCount: 0, totalOrders: 1, productsPurchased: 0, totalSpent: 280, loyaltyTier: "First-Timer", lastVisit: "2026-06-21", memberSince: "2026-06-21" },
    { id: "CUST-020", firstName: "Deema", lastName: "Al-Juraid", name: "Deema Al-Juraid", nameAr: "ديما الجريد", email: "deema.j@gmail.com", phone: "+966 50 222 4444", isWalkIn: false, customerType: "both", totalBookings: 16, noShowCount: 0, totalOrders: 6, productsPurchased: 3, totalSpent: 5100, loyaltyTier: "Gold Star", lastVisit: "2026-06-27", memberSince: "2024-12-01" },
    { id: "CUST-021", firstName: "Hala", lastName: "Al-Mutairi", name: "Hala Al-Mutairi", nameAr: "هالة المطيري", email: "hala.m@gmail.com", phone: "+966 55 777 8888", isWalkIn: false, customerType: "service_only", totalBookings: 10, noShowCount: 1, totalOrders: 4, productsPurchased: 0, totalSpent: 3000, loyaltyTier: "Silver Star", lastVisit: "2026-06-22", memberSince: "2025-07-14" },
    { id: "CUST-022", firstName: "May", lastName: "Al-Ahmad", name: "May Al-Ahmad", nameAr: "مي الأحمد", email: "may.ahmad@gmail.com", phone: "+966 56 444 8888", isWalkIn: false, customerType: "both", totalBookings: 9, noShowCount: 0, totalOrders: 3, productsPurchased: 1, totalSpent: 2950, loyaltyTier: "Silver Star", lastVisit: "2026-06-14", memberSince: "2025-11-10" },
    { id: "CUST-023", firstName: "Jomana", lastName: "Al-Shehail", name: "Jomana Al-Shehail", nameAr: "جمانة الشهيل", email: "jomana.s@vip.gov.sa", phone: "+966 50 666 1111", isWalkIn: false, customerType: "both", totalBookings: 35, noShowCount: 0, totalOrders: 15, productsPurchased: 7, totalSpent: 14500, loyaltyTier: "VIP Royal", lastVisit: "2026-06-28", memberSince: "2024-03-15" },
    { id: "CUST-024", firstName: "Lamia", lastName: "Al-Kadi", name: "Lamia Al-Kadi", nameAr: "لمياء القاضي", email: "lamia.k@gmail.com", phone: "+966 54 888 2222", isWalkIn: true, customerType: "walk_in", totalBookings: 2, noShowCount: 0, totalOrders: 1, productsPurchased: 0, totalSpent: 650, loyaltyTier: "First-Timer", lastVisit: "2026-06-28", memberSince: "2026-06-20" },
    { id: "CUST-025", firstName: "Nada", lastName: "Al-Salem", name: "Nada Al-Salem", nameAr: "ندى السالم", email: "nada.s@gmail.com", phone: "+966 53 111 8888", isWalkIn: false, customerType: "service_only", totalBookings: 13, noShowCount: 0, totalOrders: 5, productsPurchased: 0, totalSpent: 4200, loyaltyTier: "Gold Star", lastVisit: "2026-06-23", memberSince: "2025-04-05" },
    { id: "CUST-026", firstName: "Ghalia", lastName: "Al-Thani", name: "Ghalia Al-Thani", nameAr: "غالية الثاني", email: "ghalia.t@gmail.com", phone: "+966 50 333 9999", isWalkIn: false, customerType: "both", totalBookings: 27, noShowCount: 0, totalOrders: 10, productsPurchased: 4, totalSpent: 10200, loyaltyTier: "VIP Royal", lastVisit: "2026-06-29", memberSince: "2024-08-18" },
    { id: "CUST-027", firstName: "Salma", lastName: "Al-Fares", name: "Salma Al-Fares", nameAr: "سلمى الفارس", email: "salma.f@outlook.com", phone: "+966 55 999 4444", isWalkIn: false, customerType: "both", totalBookings: 12, noShowCount: 0, totalOrders: 6, productsPurchased: 2, totalSpent: 3950, loyaltyTier: "Silver Star", lastVisit: "2026-06-26", memberSince: "2025-06-10" },
    { id: "CUST-028", firstName: "Dina", lastName: "Al-Saif", name: "Dina Al-Saif", nameAr: "دينا السيف", email: "dina.s@gmail.com", phone: "+966 56 777 4444", isWalkIn: true, customerType: "walk_in", totalBookings: 1, noShowCount: 1, totalOrders: 1, productsPurchased: 0, totalSpent: 0, loyaltyTier: "First-Timer", lastVisit: "2026-05-10", memberSince: "2026-05-10" },
    { id: "CUST-029", firstName: "Rania", lastName: "Al-Dahlawi", name: "Rania Al-Dahlawi", nameAr: "رانيا الدهلوي", email: "rania.d@gmail.com", phone: "+966 54 111 4444", isWalkIn: false, customerType: "service_only", totalBookings: 8, noShowCount: 0, totalOrders: 3, productsPurchased: 0, totalSpent: 2200, loyaltyTier: "Silver Star", lastVisit: "2026-06-17", memberSince: "2025-09-01" },
    { id: "CUST-030", firstName: "Areej", lastName: "Al-Namlah", name: "Areej Al-Namlah", nameAr: "أريج النملة", email: "areej.n@gmail.com", phone: "+966 53 444 9999", isWalkIn: false, customerType: "both", totalBookings: 20, noShowCount: 0, totalOrders: 8, productsPurchased: 3, totalSpent: 7500, loyaltyTier: "Gold Star", lastVisit: "2026-06-25", memberSince: "2024-05-10" },
    { id: "CUST-031", firstName: "Dalal", lastName: "Al-Bawardi", name: "Dalal Al-Bawardi", nameAr: "دلال البواردي", email: "dalal.b@gmail.com", phone: "+966 55 222 7777", isWalkIn: false, customerType: "both", totalBookings: 14, noShowCount: 0, totalOrders: 5, productsPurchased: 2, totalSpent: 4800, loyaltyTier: "Silver Star", lastVisit: "2026-06-24", memberSince: "2025-03-12" },
    { id: "CUST-032", firstName: "Maram", lastName: "Al-Amoudi", name: "Maram Al-Amoudi", nameAr: "مرام العمودي", email: "maram.a@gmail.com", phone: "+966 56 333 1111", isWalkIn: false, customerType: "service_only", totalBookings: 6, noShowCount: 0, totalOrders: 2, productsPurchased: 0, totalSpent: 1900, loyaltyTier: "Silver Star", lastVisit: "2026-06-16", memberSince: "2025-12-05" },
    { id: "CUST-033", firstName: "Raghad", lastName: "Al-Ghofaily", name: "Raghad Al-Ghofaily", nameAr: "رغد الغفيلي", email: "raghad.g@gmail.com", phone: "+966 54 555 8888", isWalkIn: true, customerType: "walk_in", totalBookings: 1, noShowCount: 0, totalOrders: 1, productsPurchased: 0, totalSpent: 400, loyaltyTier: "First-Timer", lastVisit: "2026-06-28", memberSince: "2026-06-28" },
    { id: "CUST-034", firstName: "Lujain", lastName: "Al-Omran", name: "Lujain Al-Omran", nameAr: "لجين العمران", email: "lujain.o@gmail.com", phone: "+966 53 999 2222", isWalkIn: false, customerType: "both", totalBookings: 24, noShowCount: 0, totalOrders: 9, productsPurchased: 4, totalSpent: 8900, loyaltyTier: "Gold Star", lastVisit: "2026-06-27", memberSince: "2024-07-22" },
    { id: "CUST-035", firstName: "Monira", lastName: "Al-Sheikh", name: "Monira Al-Sheikh", nameAr: "منيرة الشيخ", email: "monira.s@gmail.com", phone: "+966 50 555 3333", isWalkIn: false, customerType: "both", totalBookings: 38, noShowCount: 0, totalOrders: 14, productsPurchased: 6, totalSpent: 15400, loyaltyTier: "VIP Royal", lastVisit: "2026-06-29", memberSince: "2024-02-14" }
  ];

  // -------------------------------------------------------------
  // CUSTOMER LEADERSHIP CRM DATABASE RULES & HELPER LOGIC
  // -------------------------------------------------------------
  
  // Persistent tenant insight records storing customer notes and tags
  const tenantInsightRecords: Record<string, { notes: string[]; tags: string[]; updatedAt: string }> = {};

  // Customer list only includes customers with tenant activity (bookings > 0 or orders > 0)
  function hasTenantActivity(c: any): boolean {
    return (c.totalBookings ?? 0) > 0 || (c.totalOrders ?? 0) > 0;
  }

  // Customer types are derived automatically: "both" | "service_only" | "product_only"
  function deriveCustomerType(c: any): string {
    const hasBookings = (c.totalBookings ?? 0) > 0;
    const hasOrders = (c.totalOrders ?? 0) > 0;
    if (hasBookings && hasOrders) return "both";
    if (hasBookings) return "service_only";
    if (hasOrders) return "product_only";
    return "service_only";
  }

  // Walk-in customers use placeholder detection
  function detectIsWalkIn(c: any): boolean {
    if (c.isWalkIn === true) return true;
    const nameLower = (c.name || "").toLowerCase();
    const emailLower = (c.email || "").toLowerCase();
    const phone = (c.phone || "");
    if (nameLower.includes("walk-in") || nameLower.includes("walkin") || nameLower.includes("guest") || nameLower.includes("عابر")) {
      return true;
    }
    if (emailLower.includes("walkin") || emailLower.includes("guest") || emailLower.includes("placeholder") || emailLower.includes("no-email")) {
      return true;
    }
    if (phone.includes("000000") || !phone) {
      return true;
    }
    return false;
  }

  // Loyalty defaults to bronze when missing
  function getLoyaltyTier(c: any): string {
    return c.loyaltyTier || "Bronze";
  }

  // Hydration utility merging insights and applying the strict business rules
  function hydrateCustomerInsightAndRules(c: any): any {
    let resolvedNotes = c.notes || [];
    let resolvedTags = c.tags || [];

    if (tenantInsightRecords[c.id]) {
      resolvedNotes = tenantInsightRecords[c.id].notes;
      resolvedTags = tenantInsightRecords[c.id].tags;
    } else {
      tenantInsightRecords[c.id] = {
        notes: resolvedNotes,
        tags: resolvedTags,
        updatedAt: new Date().toISOString()
      };
    }

    return {
      ...c,
      customerType: deriveCustomerType(c),
      isWalkIn: detectIsWalkIn(c),
      loyaltyTier: getLoyaltyTier(c),
      notes: resolvedNotes,
      tags: resolvedTags
    };
  }

  // Middleware validating the required 'view_customers' permission token
  const checkViewCustomersPermission = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const permHeader = req.headers["x-view-customers"];
    const permQuery = req.query.view_customers;
    if (permHeader === "false" || permQuery === "false") {
      return res.status(403).json({
        error: "Access Denied",
        message: "You do not have the required 'view_customers' permission to view or manage corporate client portfolios."
      });
    }
    next();
  };

  // GET /api/v1/tenant/customers/stats
  app.get("/api/v1/tenant/customers/stats", checkViewCustomersPermission, (req, res) => {
    try {
      const activeCustomers = backendCustomers.map(hydrateCustomerInsightAndRules).filter(hasTenantActivity);
      const totalCustomers = activeCustomers.length;
      
      // Calculate "joined this month" starting with "2026-06"
      const newCustomersThisMonth = activeCustomers.filter(c => c.memberSince.startsWith("2026-06")).length;
      
      // Calculate "returning rate": totalBookings > 1
      const returningCustomersCount = activeCustomers.filter(c => c.totalBookings > 1).length;
      const returningRate = totalCustomers > 0 ? Number(((returningCustomersCount / totalCustomers) * 100).toFixed(1)) : 0;
      
      // Calculate "average bookings per customer"
      const totalBookingsCount = activeCustomers.reduce((sum, c) => sum + (c.totalBookings || 0), 0);
      const avgBookings = totalCustomers > 0 ? Number((totalBookingsCount / totalCustomers).toFixed(1)) : 0;

      res.json({
        totalCustomers,
        newCustomersThisMonth,
        returningRate,
        avgBookings
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load customer stats." });
    }
  });

  // GET /api/v1/tenant/customers/export
  app.get("/api/v1/tenant/customers/export", checkViewCustomersPermission, (req, res) => {
    try {
      const q = (req.query.search as string || "").toLowerCase().trim();
      const loyaltyTier = req.query.loyaltyTier as string || "all";
      const customerType = req.query.customerType as string || "all";
      const sortBy = req.query.sortBy as string || "name";
      const sortOrder = req.query.sortOrder as string || "asc";

      let filtered = backendCustomers.map(hydrateCustomerInsightAndRules).filter(hasTenantActivity);
      if (q) {
        filtered = filtered.filter(c => 
          (c.firstName || "").toLowerCase().includes(q) ||
          (c.lastName || "").toLowerCase().includes(q) ||
          (c.name || "").toLowerCase().includes(q) ||
          (c.nameAr && c.nameAr.toLowerCase().includes(q)) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
        );
      }
      if (loyaltyTier !== "all") {
        filtered = filtered.filter(c => c.loyaltyTier === loyaltyTier);
      }
      if (customerType !== "all") {
        filtered = filtered.filter(c => c.customerType === customerType);
      }
      
      filtered.sort((a, b) => {
        let valA = a[sortBy as keyof any] ?? "";
        let valB = b[sortBy as keyof any] ?? "";
        
        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (typeof valA === "number" && typeof valB === "number") {
          return sortOrder === "asc" ? valA - valB : valB - valA;
        }
        return 0;
      });

      const headers = ["ID", "Name En", "Name Ar", "Email", "Phone", "Customer Type", "Walk-In", "Total Bookings", "No-Shows", "Total Orders", "Products Purchased", "Total Spent (SAR)", "Loyalty Tier", "Last Visit", "Joined Date"];
      const rows = filtered.map(c => [
        c.id,
        c.name,
        c.nameAr || "",
        c.email,
        c.phone,
        c.customerType,
        c.isWalkIn ? "Yes" : "No",
        c.totalBookings,
        c.noShowCount,
        c.totalOrders,
        c.productsPurchased,
        c.totalSpent,
        c.loyaltyTier,
        c.lastVisit,
        c.memberSince
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=customers_export.csv");
      res.status(200).send(csvContent);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to export CSV." });
    }
  });

  // GET /api/v1/tenant/customers
  app.get("/api/v1/tenant/customers", checkViewCustomersPermission, (req, res) => {
    try {
      const q = (req.query.search as string || "").toLowerCase().trim();
      const loyaltyTier = req.query.loyaltyTier as string || "all";
      const customerType = req.query.customerType as string || "all";
      const sortBy = req.query.sortBy as string || "name";
      const sortOrder = req.query.sortOrder as string || "asc";
      const page = parseInt(req.query.page as string || "1", 10);
      const limit = parseInt(req.query.limit as string || "20", 10);

      let filtered = backendCustomers.map(hydrateCustomerInsightAndRules).filter(hasTenantActivity);
      if (q) {
        filtered = filtered.filter(c => 
          (c.firstName || "").toLowerCase().includes(q) ||
          (c.lastName || "").toLowerCase().includes(q) ||
          (c.name || "").toLowerCase().includes(q) ||
          (c.nameAr && c.nameAr.toLowerCase().includes(q)) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
        );
      }
      if (loyaltyTier !== "all") {
        filtered = filtered.filter(c => c.loyaltyTier === loyaltyTier);
      }
      if (customerType !== "all") {
        filtered = filtered.filter(c => c.customerType === customerType);
      }
      
      filtered.sort((a, b) => {
        let valA = a[sortBy as keyof any] ?? "";
        let valB = b[sortBy as keyof any] ?? "";
        
        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (typeof valA === "number" && typeof valB === "number") {
          return sortOrder === "asc" ? valA - valB : valB - valA;
        }
        return 0;
      });

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedCustomers = filtered.slice(startIndex, endIndex);

      res.json({
        customers: paginatedCustomers,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load customers." });
    }
  });

  // GET /api/v1/tenant/customers/:id
  app.get("/api/v1/tenant/customers/:id", checkViewCustomersPermission, (req, res) => {
    try {
      const { id } = req.params;
      const rawCustomer = backendCustomers.find(c => c.id === id);
      if (!rawCustomer) {
        return res.status(404).json({ error: "Customer not found." });
      }

      const customer = hydrateCustomerInsightAndRules(rawCustomer);

      const walletHistory = req.query.walletHistory as string;
      const balance = customer.walletBalance ?? 450;
      const entriesCount = customer.walletEntriesCount ?? 4;
      const sentCount = customer.giftCardsSent ?? 1;
      const receivedCount = customer.giftCardsReceived ?? 2;

      const fullLedger = [
        {
          id: `ledger-${id}-4`,
          type: "debit",
          amount: 20,
          balanceBefore: 470,
          balanceAfter: 450,
          referenceType: "Product Purchase",
          timestamp: "2026-06-28T18:45:00Z"
        },
        {
          id: `ledger-${id}-3`,
          type: "credit",
          amount: 120,
          balanceBefore: 350,
          balanceAfter: 470,
          referenceType: "Service Refund",
          timestamp: "2026-06-25T11:00:00Z"
        },
        {
          id: `ledger-${id}-2`,
          type: "debit",
          amount: 150,
          balanceBefore: 500,
          balanceAfter: 350,
          referenceType: "Appointment Booking",
          timestamp: "2026-06-20T10:15:00Z"
        },
        {
          id: `ledger-${id}-1`,
          type: "credit",
          amount: 500,
          balanceBefore: 0,
          balanceAfter: 500,
          referenceType: "Gift Card Claim",
          timestamp: "2026-06-15T14:30:00Z"
        }
      ];

      const fullGiftCards = [
        {
          id: `gc-${id}-1`,
          packageTitle: "Royal Spa Package",
          packageTitleAr: "باقة السبا الملكية",
          purchaseAmount: 500,
          totalCreditAmount: 600,
          bonusAmount: 100,
          status: "claimed",
          deliveryChannel: "WhatsApp",
          createdDate: "2026-06-10",
          claimedDate: "2026-06-15"
        },
        {
          id: `gc-${id}-2`,
          packageTitle: "Nails & Glow Deluxe",
          packageTitleAr: "باقة الأظافر والنضارة ديلوكس",
          purchaseAmount: 300,
          totalCreditAmount: 350,
          bonusAmount: 50,
          status: "active",
          deliveryChannel: "Email",
          createdDate: "2026-06-25",
          claimedDate: null
        },
        {
          id: `gc-${id}-3`,
          packageTitle: "Eid Al-Adha Celebration Gift",
          packageTitleAr: "هدية احتفال عيد الأضحى المبارك",
          purchaseAmount: 200,
          totalCreditAmount: 200,
          bonusAmount: 0,
          status: "expired",
          deliveryChannel: "SMS",
          createdDate: "2025-06-25",
          claimedDate: null
        }
      ];

      if (walletHistory === 'full') {
        return res.json({
          ...customer,
          walletBalance: balance,
          walletEntriesCount: entriesCount,
          giftCardsSent: sentCount,
          giftCardsReceived: receivedCount,
          walletLedger: fullLedger,
          giftCards: fullGiftCards
        });
      } else {
        // Return limited wallet history
        return res.json({
          ...customer,
          walletBalance: balance,
          walletEntriesCount: entriesCount,
          giftCardsSent: sentCount,
          giftCardsReceived: receivedCount,
          walletLedger: fullLedger.slice(0, 2),
          giftCards: fullGiftCards.slice(0, 1)
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to retrieve customer details." });
    }
  });

  // PATCH /api/v1/tenant/customers/:id/profile
  app.patch("/api/v1/tenant/customers/:id/profile", checkViewCustomersPermission, (req, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, phone, gender, birthdate, preferredLanguage } = req.body;
      
      const customer = backendCustomers.find(c => c.id === id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found." });
      }

      // Email collision check
      if (email && email.trim()) {
        const cleanEmail = email.toLowerCase().trim();
        const emailCollision = backendCustomers.find(c => c.id !== id && c.email.toLowerCase().trim() === cleanEmail);
        if (emailCollision) {
          return res.status(400).json({ error: "Email address is already registered to another customer." });
        }
      }

      // Phone collision check
      if (phone && phone.trim()) {
        const cleanPhone = phone.replace(/[\s\-+()]/g, '');
        const phoneCollision = backendCustomers.find(c => {
          if (c.id === id) return false;
          const cPhone = c.phone.replace(/[\s\-+()]/g, '');
          return cPhone === cleanPhone;
        });
        if (phoneCollision) {
          return res.status(400).json({ error: "Phone number is already registered to another customer." });
        }
      }

      // Apply updates
      if (firstName !== undefined) customer.firstName = firstName.trim();
      if (lastName !== undefined) customer.lastName = lastName.trim();
      if (firstName !== undefined || lastName !== undefined) {
        customer.name = `${customer.firstName} ${customer.lastName}`;
      }
      if (email !== undefined) customer.email = email.trim();
      if (phone !== undefined) customer.phone = phone.trim();
      if (gender !== undefined) customer.gender = gender;
      if (birthdate !== undefined) customer.birthdate = birthdate;
      if (preferredLanguage !== undefined) customer.preferredLanguage = preferredLanguage;

      res.json(hydrateCustomerInsightAndRules(customer));
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update customer profile." });
    }
  });

  // PATCH /api/v1/tenant/customers/:id/notes
  app.patch("/api/v1/tenant/customers/:id/notes", checkViewCustomersPermission, (req, res) => {
    try {
      const { id } = req.params;
      const { notes, tags } = req.body;

      const customer = backendCustomers.find(c => c.id === id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found." });
      }

      // Store securely in tenantInsightRecords
      tenantInsightRecords[id] = {
        notes: notes !== undefined ? notes : (tenantInsightRecords[id]?.notes || customer.notes || []),
        tags: tags !== undefined ? tags : (tenantInsightRecords[id]?.tags || customer.tags || []),
        updatedAt: new Date().toISOString()
      };

      res.json(hydrateCustomerInsightAndRules(customer));
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update customer notes." });
    }
  });

  // GET /api/v1/tenant/customers/:id/history
  app.get("/api/v1/tenant/customers/:id/history", (req, res) => {
    try {
      const { id } = req.params;
      const customer = backendCustomers.find(c => c.id === id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found." });
      }

      const typeQuery = req.query.type as string || 'all'; // 'all' | 'appointments' | 'purchases'
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const limitVal = parseInt(req.query.limit as string || "50", 10);
      const statusQuery = req.query.status as string || 'all'; // 'all' | 'completed' | 'pending' | 'cancelled'

      // Helper function to generate history
      const servicesList = [
        { en: "Royal Swedish Massage", ar: "جلسة مساج السويدي الملكي", price: 350, stylist: "Layla Al-Asiri", stylistAr: "ليلى العسيري" },
        { en: "Platinum Hydrafacial", ar: "تنظيف بشرة هيدرافيشال بلاتينيوم", price: 650, stylist: "Layla Al-Asiri", stylistAr: "ليلى العسيري" },
        { en: "Balayage & Premium Styling", ar: "بالياج مع تسريح بريميوم", price: 850, stylist: "Nadeen Al-Harbi", stylistAr: "نادين الحربي" },
        { en: "Nail Polish Deluxe", ar: "طلاء أظافر ديلوكس", price: 150, stylist: "Elena Vasily", stylistAr: "إيلينا فاسيلي" },
        { en: "Manicure Deluxe", ar: "باديكير مانيكير ديلوكس", price: 200, stylist: "Elena Vasily", stylistAr: "إيلينا فاسيلي" },
        { en: "Blowdry Luxury Session", ar: "غسيل وتسريح بريميوم", price: 250, stylist: "Elena Vasily", stylistAr: "إيلينا فاسيلي" }
      ];

      const productsList = [
        { en: "Olaplex No. 3 Hair Perfector & Kerastase Serum", ar: "أولابليكس رقم 3 وسيروم كريستاس", price: 380 },
        { en: "Moroccanoil Treatment & Dyson Filter", ar: "علاج موروكان أويل وفلتر دايسون", price: 290 },
        { en: "Senscience Silk Moisture Shampoo", ar: "شامبو سينسينس لترطيب الشعر", price: 120 },
        { en: "Balmain Hair Perfume Mist", ar: "عطر بالمان الفاخر للشعر", price: 450 }
      ];

      const statuses: ('completed' | 'pending' | 'cancelled')[] = ['completed', 'completed', 'completed', 'pending', 'cancelled'];
      const historyRows: any[] = [];

      const appointmentsCount = customer.totalBookings || 5;
      const purchasesCount = customer.totalOrders || 2;

      // 1. Appointments
      for (let i = 0; i < appointmentsCount; i++) {
        const s = servicesList[i % servicesList.length];
        const status = statuses[i % statuses.length];
        const dateObj = new Date("2026-06-28");
        dateObj.setDate(dateObj.getDate() - (i * 4));
        const dateStr = dateObj.toISOString().slice(0, 10);

        historyRows.push({
          id: `apt-${customer.id}-${i}`,
          type: "appointment",
          service: s.en,
          serviceAr: s.ar,
          provider: s.stylist,
          providerAr: s.stylistAr,
          status: status,
          date: dateStr,
          amount: s.price
        });
      }

      // 2. Purchases
      for (let i = 0; i < purchasesCount; i++) {
        const p = productsList[i % productsList.length];
        const status = statuses[(i + 1) % statuses.length];
        const dateObj = new Date("2026-06-26");
        dateObj.setDate(dateObj.getDate() - (i * 7) - 2);
        const dateStr = dateObj.toISOString().slice(0, 10);

        historyRows.push({
          id: `ord-${customer.id}-${i}`,
          type: "purchase",
          products: p.en,
          productsAr: p.ar,
          status: status,
          date: dateStr,
          amount: p.price
        });
      }

      // Sort descending by date
      historyRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Metrics calculation over total generated history
      const appointmentsOnly = historyRows.filter(h => h.type === "appointment");
      const purchasesOnly = historyRows.filter(h => h.type === "purchase");

      const totalInteractions = historyRows.length;
      const totalAppointments = appointmentsOnly.length;
      const totalOrders = purchasesOnly.length;

      const appointmentSpending = appointmentsOnly.reduce((sum, h) => sum + h.amount, 0);
      const orderSpending = purchasesOnly.reduce((sum, h) => sum + h.amount, 0);
      const totalSpent = appointmentSpending + orderSpending;

      const metrics = {
        totalInteractions,
        totalAppointments,
        totalOrders,
        totalSpent,
        appointmentSpending,
        orderSpending
      };

      // Apply filtering to final returned rows
      let filteredRows = [...historyRows];

      // Filter by type
      if (typeQuery === 'appointments') {
        filteredRows = filteredRows.filter(h => h.type === 'appointment');
      } else if (typeQuery === 'purchases') {
        filteredRows = filteredRows.filter(h => h.type === 'purchase');
      }

      // Filter by status
      if (statusQuery !== 'all') {
        filteredRows = filteredRows.filter(h => h.status === statusQuery);
      }

      // Filter by dates
      if (startDate) {
        filteredRows = filteredRows.filter(h => h.date >= startDate);
      }
      if (endDate) {
        filteredRows = filteredRows.filter(h => h.date <= endDate);
      }

      // Apply limit
      const finalRows = filteredRows.slice(0, limitVal);

      res.json({
        metrics,
        history: finalRows
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to retrieve history." });
    }
  });



  // ==========================================
  // PAGE SETUP & BUSINESS SETTINGS MODULE
  // ==========================================

  interface SectionsVisibility {
    services: boolean;
    products: boolean;
    reviews: boolean;
    about: boolean;
  }

  interface PublicPageData {
    coverImage: string;
    sectionsVisibility: SectionsVisibility;
    aboutTitleAr: string;
    aboutTitleEn: string;
    aboutTextAr: string;
    aboutTextEn: string;
    gallery: string[];
    heroSlider?: any[];
  }

  interface BusinessSettings {
    address: string;
    googleMapLink: string;
    phone: string;
    email: string;
    website: string;
    instagram: string;
    twitter: string;
    tiktok: string;
    youtube: string;
    linkedin: string;
    snapchat: string;
  }

  let publicPageData: PublicPageData = {
    coverImage: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
    sectionsVisibility: {
      services: true,
      products: true,
      reviews: true,
      about: true
    },
    aboutTitleAr: "قصة صالون رفاه الفاخر",
    aboutTitleEn: "The Prestigious Story of REFAH Salon",
    aboutTextAr: "منذ تأسيسنا، التزمنا في صالون رفاه بتقديم أرقى خدمات التجميل والاسترخاء والعناية الفائقة بأعلى مقاييس الفخامة والخصوصية، لنمنح ضيوفنا تجربة متكاملة تتعدى التوقعات وتلبي رغبات الباحثين عن التميز.",
    aboutTextEn: "Since our establishment, we at REFAH have committed to delivering the finest beauty, spa, and premium hair treatments under strict privacy and luxury standards. We offer our esteemed guests an unparalleled experience of elegance.",
    gallery: [
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=600&q=80"
    ],
    heroSlider: []
  };

  let businessSettings: BusinessSettings = {
    address: "طريق التخصصي، حي المعذر، الرياض 12721، المملكة العربية السعودية",
    googleMapLink: "https://maps.google.com/?q=Refah+Salon+Riyadh",
    phone: "+966 11 488 2323",
    email: "prestige@refahsalon.com",
    website: "https://refahsalon.com",
    instagram: "@refah.salon.prestige",
    twitter: "@refah_salon",
    tiktok: "@refah.salon",
    youtube: "@refah_salon_channel",
    linkedin: "company/refah-salon",
    snapchat: "@refah.snap"
  };

  // GET /api/v1/tenant/public-page
  app.get("/api/v1/tenant/public-page", (req, res) => {
    try {
      res.json(publicPageData);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to retrieve public page content." });
    }
  });

  // PUT /api/v1/tenant/public-page
  app.put("/api/v1/tenant/public-page", (req, res) => {
    try {
      const { coverImage, sectionsVisibility, aboutTitleAr, aboutTitleEn, aboutTextAr, aboutTextEn, gallery } = req.body;
      
      // Validation: At least one section must remain visible
      if (sectionsVisibility) {
        const { services, products, reviews, about } = sectionsVisibility;
        const visibleCount = [services, products, reviews, about].filter(v => v === true).length;
        if (visibleCount === 0) {
          return res.status(400).json({ 
            error: "At least one section must remain visible / يجب أن يظل هناك قسم واحد مرئي على الأقل." 
          });
        }
        publicPageData.sectionsVisibility = {
          services: !!services,
          products: !!products,
          reviews: !!reviews,
          about: !!about
        };
      }

      if (coverImage !== undefined) {
        publicPageData.coverImage = coverImage;
      }
      if (aboutTitleAr !== undefined) {
        publicPageData.aboutTitleAr = aboutTitleAr;
      }
      if (aboutTitleEn !== undefined) {
        publicPageData.aboutTitleEn = aboutTitleEn;
      }
      if (aboutTextAr !== undefined) {
        publicPageData.aboutTextAr = aboutTextAr;
      }
      if (aboutTextEn !== undefined) {
        publicPageData.aboutTextEn = aboutTextEn;
      }
      if (gallery !== undefined) {
        // Enforce maximum images limit of 10
        if (Array.isArray(gallery)) {
          if (gallery.length > 10) {
            return res.status(400).json({ error: "Maximum images allowed in gallery is 10 / الحد الأقصى للصور بالمعرض هو 10 صور." });
          }
          publicPageData.gallery = gallery;
        }
      }

      res.json(publicPageData);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update public page content." });
    }
  });

  // PUT /api/v1/tenant/public-page/hero-slider
  app.put("/api/v1/tenant/public-page/hero-slider", (req, res) => {
    try {
      const { slides } = req.body;
      if (Array.isArray(slides)) {
        publicPageData.heroSlider = slides;
      }
      res.json({ success: true, heroSlider: publicPageData.heroSlider });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update hero slider." });
    }
  });

  // GET /api/v1/tenant/settings
  app.get("/api/v1/tenant/settings", (req, res) => {
    try {
      res.json({
        business: businessSettings
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to retrieve settings." });
    }
  });

  // PUT /api/v1/tenant/settings/business
  app.put("/api/v1/tenant/settings/business", (req, res) => {
    try {
      const { 
        address, googleMapLink, phone, email, website, 
        instagram, twitter, tiktok, youtube, linkedin, snapchat 
      } = req.body;

      if (address !== undefined) businessSettings.address = address;
      if (googleMapLink !== undefined) businessSettings.googleMapLink = googleMapLink;
      if (phone !== undefined) businessSettings.phone = phone;
      if (email !== undefined) businessSettings.email = email;
      if (website !== undefined) businessSettings.website = website;
      if (instagram !== undefined) businessSettings.instagram = instagram;
      if (twitter !== undefined) businessSettings.twitter = twitter;
      if (tiktok !== undefined) businessSettings.tiktok = tiktok;
      if (youtube !== undefined) businessSettings.youtube = youtube;
      if (linkedin !== undefined) businessSettings.linkedin = linkedin;
      if (snapchat !== undefined) businessSettings.snapchat = snapchat;

      res.json({ success: true, business: businessSettings });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update business settings." });
    }
  });


  // ==========================================
  // APPOINTMENTS MODULE (API CONTRACT)
  // ==========================================
  interface ServerAppointment {
    id: string;
    customerId?: string;
    customerMode?: string;
    customerNameEn?: string;
    customerNameAr?: string;
    customerPhone?: string;
    customerEmail?: string;
    loyaltyTier?: string;
    walletBalance?: number;
    serviceNameEn?: string;
    serviceNameAr?: string;
    serviceCategory?: string;
    staffId?: string;
    startTime?: number;
    duration?: number;
    status: string; // e.g., 'confirmed', 'pending', 'cancelled'
    paymentStatus: string; // e.g., 'paid', 'unpaid', 'partially_paid'
    paymentMethod?: string;
    paymentAllocations?: any[];
    transactionRef?: string;
    isGroupBooking?: boolean;
    guestCount?: number;
    guestsDetails?: any[]; // GuestProfiles with their individual services
    date?: string; // YYYY-MM-DD
    hasNotes?: boolean;
    notes?: string;
    price: number;
    tags?: string[];
    type?: string;
    metadata?: any;
  }

  let serverAppointments: ServerAppointment[] = [
    {
      id: "apt-1",
      customerId: "CUST-001",
      customerNameEn: "Sarah Abdullah",
      customerNameAr: "سارة عبد الله",
      customerPhone: "+966 50 123 4567",
      customerEmail: "sarah@example.com",
      serviceNameEn: "Royal Swedish Massage with Aromatherapy",
      serviceNameAr: "جلسة مساج السويدي الملكي بالأروما",
      serviceCategory: "spa",
      staffId: "st-1",
      startTime: 540, // 9:00 AM
      duration: 90,
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "cash",
      date: "2026-06-28",
      price: 450,
      tags: ["VIP", "Live Booked"],
      type: "appointment"
    }
  ];

  // 1. POST /api/v1/tenant/appointments
  app.post("/api/v1/tenant/appointments", (req, res) => {
    try {
      const payload = req.body;
      const id = payload.id || `apt-created-${Date.now()}`;
      const newApt: ServerAppointment = {
        ...payload,
        id,
        status: payload.status || 'confirmed',
        paymentStatus: payload.paymentStatus || 'unpaid',
        type: 'appointment'
      };
      serverAppointments.push(newApt);
      res.status(201).json({
        success: true,
        message: "Appointment created",
        data: newApt
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create appointment." });
    }
  });

  // 2. GET /api/v1/tenant/appointments
  app.get("/api/v1/tenant/appointments", (req, res) => {
    try {
      res.json(serverAppointments);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load appointments." });
    }
  });

  // 3. GET /api/v1/tenant/appointments/:id
  app.get("/api/v1/tenant/appointments/:id", (req, res) => {
    try {
      const apt = serverAppointments.find(a => a.id === req.params.id);
      if (!apt) {
        return res.status(404).json({ error: "Appointment not found." });
      }
      res.json({
        success: true,
        data: apt
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch appointment." });
    }
  });

  // 4. PATCH /api/v1/tenant/appointments/:id/payment
  app.patch("/api/v1/tenant/appointments/:id/payment", (req, res) => {
    try {
      const { id } = req.params;
      const index = serverAppointments.findIndex(a => a.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Appointment not found." });
      }
      const { paymentStatus, paymentMethod, amount, paymentAllocations, transactionRef, notes } = req.body;

      serverAppointments[index] = {
        ...serverAppointments[index],
        paymentStatus: paymentStatus || serverAppointments[index].paymentStatus,
        paymentMethod: paymentMethod || serverAppointments[index].paymentMethod,
        price: amount !== undefined ? amount : serverAppointments[index].price,
        paymentAllocations: paymentAllocations !== undefined ? paymentAllocations : serverAppointments[index].paymentAllocations,
        transactionRef: transactionRef !== undefined ? transactionRef : serverAppointments[index].transactionRef,
        notes: notes !== undefined ? notes : serverAppointments[index].notes
      };

      res.json({
        success: true,
        message: "Payment status updated",
        data: serverAppointments[index]
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update payment." });
    }
  });

  // 5. PUT /api/v1/tenant/appointments/:id
  app.put("/api/v1/tenant/appointments/:id", (req, res) => {
    try {
      const { id } = req.params;
      const index = serverAppointments.findIndex(a => a.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Appointment not found." });
      }
      serverAppointments[index] = {
        ...req.body,
        id
      };
      res.json({
        success: true,
        message: "Appointment fully replaced",
        data: serverAppointments[index]
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to replace appointment." });
    }
  });

  // 6. PATCH /api/v1/tenant/appointments/:id
  app.patch("/api/v1/tenant/appointments/:id", (req, res) => {
    try {
      const { id } = req.params;
      const index = serverAppointments.findIndex(a => a.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Appointment not found." });
      }
      serverAppointments[index] = {
        ...serverAppointments[index],
        ...req.body
      };
      res.json({
        success: true,
        message: "Appointment partially updated",
        data: serverAppointments[index]
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to partially update appointment." });
    }
  });


  // Serve frontend files via Vite in dev mode or static files in production mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
