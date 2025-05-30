import React from 'react';
import { 
  ChatBubbleLeftRightIcon, 
  TicketIcon, 
  ClockIcon, 
  EnvelopeIcon 
} from '@heroicons/react/24/outline';

const ServiceFilter = ({ activeServices, onToggleService }) => {
  const services = [
    { id: 'slack', name: 'Slack', icon: ChatBubbleLeftRightIcon, color: 'bg-purple-100 text-purple-800' },
    { id: 'zendesk', name: 'Zendesk', icon: TicketIcon, color: 'bg-green-100 text-green-800' },
    { id: 'harvest', name: 'Harvest', icon: ClockIcon, color: 'bg-orange-100 text-orange-800' },
    { id: 'email', name: 'Email', icon: EnvelopeIcon, color: 'bg-blue-100 text-blue-800' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {services.map((service) => {
        const isActive = activeServices.includes(service.id);
        const ServiceIcon = service.icon;
        
        return (
          <button
            key={service.id}
            onClick={() => onToggleService(service.id)}
            className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive 
                ? service.color
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <ServiceIcon className="h-4 w-4 mr-1.5" />
            {service.name}
          </button>
        );
      })}
    </div>
  );
};

export default ServiceFilter;