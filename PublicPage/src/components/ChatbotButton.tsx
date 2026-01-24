import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface QuickReply {
  text: string;
  response: string;
}

export const ChatbotButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! Welcome to JASMIN Spa & Salon. How can I assist you today?',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickReplies: QuickReply[] = [
    { text: 'Book an appointment', response: 'I can help you book an appointment' },
    { text: 'View services', response: 'We offer a wide range of services' },
    { text: 'Check prices', response: 'Let me help you with pricing information' },
    { text: 'Opening hours', response: 'We are open Saturday–Thursday: 11:00 AM – 12:00 AM, and Friday: 1:00 PM – 12:00 AM' },
    { text: 'Browse products', response: 'We have premium beauty products available' },
    { text: 'Contact information', response: 'You can reach us at +966 12 345 6789 or email contact@jasminspa.com' },
  ];

  const knowledgeBase: { [key: string]: string } = {
    // Greetings
    'hello': 'Hello! Welcome to JASMIN Spa & Salon. How can I help you today?',
    'hi': 'Hi there! Welcome to JASMIN. What can I do for you?',
    'hey': 'Hey! Thanks for reaching out. How may I assist you?',
    'good morning': 'Good morning! How can I make your day beautiful?',
    'good afternoon': 'Good afternoon! What brings you to JASMIN today?',
    'good evening': 'Good evening! How may I help you relax today?',
    
    // Services
    'services': 'We offer a wide range of luxury spa and salon services including:\n\n• Signature Massages\n• Facial Treatments\n• Hair Care & Styling\n• Manicure & Pedicure\n• Body Treatments\n• Makeup Services\n\nWould you like to know more about any specific service?',
    'massage': 'Our massage services include Swedish, Deep Tissue, Hot Stone, and Aromatherapy massages. Prices range from 250-450 SAR. Each session is 60-90 minutes with our expert therapists.',
    'facial': 'We offer premium facial treatments including Deep Cleansing, Anti-Aging, Hydrating, and Gold Facials. Prices start from 200 SAR. All facials include skin analysis and personalized care.',
    'hair': 'Our hair services include cuts, styling, coloring, treatments, and keratin services. Prices vary by service. Our stylists are internationally certified.',
    'manicure': 'We offer classic and spa manicures, gel polish, nail art, and extensions. Prices start from 80 SAR. All products are premium quality.',
    'pedicure': 'Our pedicure services include spa pedicures, gel polish, and foot treatments. Prices start from 100 SAR with complimentary foot massage.',
    
    // Booking
    'book': 'You can book an appointment by:\n\n1. Clicking the "Book Now" button on our website\n2. Calling us at +966 12 345 6789\n3. Visiting us in person\n\nWould you like to proceed with booking?',
    'appointment': 'To book an appointment, please click the "Book Appointment" button on our homepage. You can choose your preferred service, date, time, and specialist. We offer both in-center and home visit options.',
    'reservation': 'To make a reservation, use our online booking system or call +966 12 345 6789. We recommend booking at least 24 hours in advance for best availability.',
    'cancel': 'To cancel an appointment, please call us at least 24 hours in advance at +966 12 345 6789. Cancellations made less than 24 hours before may incur a fee.',
    
    // Products
    'products': 'We offer premium JASMIN beauty products including:\n\n• Jasmine Radiance Serum (289 SAR)\n• Pure Jasmine Essential Oil (189 SAR)\n• Luxury Face Cream (349 SAR)\n• Botanical Body Oil (229 SAR)\n• Nourishing Hair Oil (169 SAR)\n• Complete Skincare Sets\n\nAll products use natural ingredients and jasmine extracts.',
    'serum': 'Our Jasmine Radiance Serum (289 SAR) is our signature product. It brightens skin tone, reduces fine lines, and provides deep hydration with pure jasmine extract and vitamin C.',
    'cream': 'Our Luxury Face Cream (349 SAR) contains jasmine extract, shea butter, and 24K gold particles. It provides intense hydration and a radiant glow.',
    'oil': 'We have two popular oils:\n\n1. Pure Jasmine Essential Oil (189 SAR) - Perfect for aromatherapy and relaxation\n2. Botanical Body Oil (229 SAR) - Blend of jasmine, argan, and jojoba oils',
    
    // Pricing
    'price': 'Our prices vary by service:\n\n• Massages: 250-450 SAR\n• Facials: 200-400 SAR\n• Hair Services: 150-500 SAR\n• Manicure: 80-200 SAR\n• Pedicure: 100-250 SAR\n• Products: 169-699 SAR\n\nWould you like detailed pricing for a specific service?',
    'cost': 'Service costs vary. Massages start from 250 SAR, facials from 200 SAR, and hair services from 150 SAR. Products range from 169-699 SAR. Would you like specific pricing?',
    'expensive': 'We offer services at various price points to suit different budgets. Our premium quality and expert care ensure excellent value. We also have package deals and special offers!',
    'cheap': 'We maintain premium quality while offering competitive pricing. Our entry-level services start from 80 SAR for manicures and 150 SAR for hair cuts. Quality is never compromised!',
    
    // Location & Hours
    'location': 'We are located at Anas Ibn Malik Road, Riyadh, Saudi Arabia. You can find us easily on Google Maps. We have ample parking available.',
    'address': 'Our address is Anas Ibn Malik Road, Riyadh, Saudi Arabia. Call us at +966 12 345 6789 for directions.',
    'hours': 'Our working hours are:\n\n• Saturday–Thursday: 11:00 AM – 12:00 AM\n• Friday: 1:00 PM – 12:00 AM\n\nWe recommend calling ahead to confirm availability.',
    'open': 'We are open Saturday–Thursday from 11:00 AM to 12:00 AM, and Friday from 1:00 PM to 12:00 AM.',
    'closed': 'We are closed only for public holidays. During Ramadan, we have special hours. Please call ahead to confirm.',
    
    // Contact
    'phone': 'You can call us at +966 12 345 6789. Our team is available during working hours to assist you.',
    'email': 'You can email us at contact@jasminspa.com. We typically respond within 24 hours.',
    'contact': 'You can reach us at:\n\n📞 Phone: +966 12 345 6789\n📧 Email: contact@jasminspa.com\n📍 Address: Anas Ibn Malik Road, Riyadh\n\nOr visit our Contact page for more options.',
    'whatsapp': 'Yes! You can reach us on WhatsApp at +966 12 345 6789 for quick inquiries and bookings.',
    
    // Payment
    'payment': 'We accept multiple payment methods:\n\n• Cash\n• Credit/Debit Cards\n• Apple Pay\n• Online Payment\n• Payment at Center\n\nFor products, you can also pay on delivery.',
    'card': 'Yes, we accept all major credit and debit cards including Visa, Mastercard, Mada, and American Express.',
    'cash': 'Yes, we accept cash payments at our center for both services and products.',
    
    // Special Requests
    'home visit': 'Yes! We offer home visit services for selected treatments. You can choose this option when booking. Additional charges may apply based on location.',
    'gift': 'We offer beautiful gift certificates and product gift sets. Perfect for special occasions! Contact us for custom gift packages.',
    'membership': 'We have exclusive membership packages with special rates and priority booking. Call us at +966 12 345 6789 to learn more about our VIP memberships.',
    'discount': 'We regularly offer special promotions and package deals. Follow us on social media or subscribe to our newsletter for exclusive offers!',
    
    // Staff
    'staff': 'Our team consists of internationally certified professionals with years of experience. All our therapists and stylists are specially trained in luxury spa services.',
    'therapist': 'You can choose your preferred therapist when booking. All our therapists are certified and have extensive experience in spa treatments.',
    
    // Thank you
    'thank': 'You\'re welcome! If you need anything else, feel free to ask. We\'re here to help! 💐',
    'thanks': 'My pleasure! Don\'t hesitate to reach out if you have more questions. Have a wonderful day! ✨',
    
    // Goodbye
    'bye': 'Goodbye! Thank you for chatting with us. We look forward to welcoming you to JASMIN soon! 🌸',
    'goodbye': 'Thank you for your interest in JASMIN! Have a beautiful day and we hope to see you soon! 💫',
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getBotResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Check for exact matches or partial matches
    for (const [key, response] of Object.entries(knowledgeBase)) {
      if (lowerMessage.includes(key)) {
        return response;
      }
    }
    
    // Default response if no match found
    return 'Thank you for your message! For specific inquiries, please:\n\n• Call us at +966 12 345 6789\n• Email contact@jasminspa.com\n• Visit our Contact page\n\nOur team will be happy to assist you!';
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setShowQuickReplies(false);

    // Simulate bot typing delay
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getBotResponse(inputValue),
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    }, 800);
  };

  const handleQuickReply = (reply: QuickReply) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text: reply.text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setShowQuickReplies(false);

    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getBotResponse(reply.text),
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    }, 800);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white rounded-full shadow-2xl hover:shadow-[var(--color-primary)]/50 transition-all duration-300 hover:scale-110 flex items-center justify-center"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-28 right-8 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: '500px' }}>
          <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white p-4">
            <h4 className="text-white">JASMIN Virtual Assistant</h4>
            <p className="text-sm text-white/90">We're here to help you 24/7</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-3 ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                </div>
              </div>
            ))}

            {showQuickReplies && messages.length === 1 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-gray-500 text-center">Quick replies:</p>
                <div className="grid grid-cols-2 gap-2">
                  {quickReplies.map((reply, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickReply(reply)}
                      className="text-xs px-3 py-2 bg-white border-2 border-[var(--color-primary)]/30 text-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary)]/10 transition-all duration-300"
                    >
                      {reply.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t bg-gray-50">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white rounded-full flex items-center justify-center hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
