import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Utensils, Activity, Moon, ChevronLeft, Heart, Coffee, Droplet, 
  RefreshCw, AlertCircle, Loader, Check, Calendar, User 
} from "lucide-react";

const PatientWellnessPlan = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [wellnessPlan, setWellnessPlan] = useState(null);
  const [error, setError] = useState(null);

  // Map for lifestyle icon rendering
  const lifestyleIcons = {
    "Sleep": Moon,
    "Hydration": Droplet,
    "Stress": Coffee,
    // Add more mappings as needed
  };

  useEffect(() => {
    fetchWellnessPlan();
  }, [id]);

  const fetchWellnessPlan = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8080/api/wellness-plan/${id}`);
      const data = await response.json();
      
      if (data.success && data.plan) {
        setWellnessPlan(data.plan);
      } else {
        setWellnessPlan(null);
        setError(data.message || "No wellness plan found");
      }
    } catch (err) {
      console.error("Failed to fetch wellness plan:", err);
      setError("Failed to load wellness plan data");
    } finally {
      setIsLoading(false);
    }
  };

  const generateWellnessPlan = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8080/api/generate-wellness-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patient_id: id }),
      });
      
      const data = await response.json();
      
      if (data.success && data.plan) {
        setWellnessPlan(data.plan);
      } else {
        setError(data.message || "Failed to generate wellness plan");
      }
    } catch (err) {
      console.error("Failed to generate wellness plan:", err);
      setError("An error occurred while generating the wellness plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const getIconComponent = (type) => {
    return lifestyleIcons[type] || Coffee;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8 px-6 relative">
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      
      <div className="container mx-auto relative z-10">
        {/* Back button */}
        <button 
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center px-3 py-2 bg-white rounded-xl shadow-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Patient
        </button>
        
        {/* Main content */}
        <div className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-700 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Heart className="w-5 h-5 mr-2" />
                Personalized Wellness Plan
              </h2>
              <p className="text-sm text-white/80 mt-1">
                Patient ID: {id}
              </p>
            </div>
            
            <button
              onClick={generateWellnessPlan}
              disabled={isGenerating}
              className={`flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors ${isGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isGenerating ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate New Plan
                </>
              )}
            </button>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader className="w-8 h-8 text-purple-600 animate-spin mb-4" />
                <p className="text-gray-600">Loading wellness plan...</p>
              </div>
            ) : error && !wellnessPlan ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="bg-red-50 p-4 rounded-lg mb-4 w-full max-w-md">
                  <div className="flex">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                    <div>
                      <p className="text-sm text-red-700 font-medium">No wellness plan found</p>
                      <p className="text-sm text-red-600 mt-1">{error}</p>
                      <button
                        onClick={generateWellnessPlan}
                        disabled={isGenerating}
                        className="mt-4 flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                      >
                        {isGenerating ? (
                          <>
                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Generate a wellness plan
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : wellnessPlan ? (
              <div className="space-y-8">
                {/* Generated Date */}
                {wellnessPlan.generated_at && (
                  <div className="flex items-center justify-end text-xs text-gray-500">
                    <Calendar className="w-3 h-3 mr-1" />
                    Generated on: {wellnessPlan.generated_at}
                  </div>
                )}
                
                {/* Overview Section */}
                {wellnessPlan.overview && (
                  <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                    <h3 className="font-semibold text-gray-900 mb-2">Overview</h3>
                    <p className="text-gray-700">{wellnessPlan.overview}</p>
                  </div>
                )}
                
                {/* Diet Section */}
                <div>
                  <div className="mb-5 border-b border-gray-100 pb-2">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                      <Utensils className="w-5 h-5 mr-2 text-purple-600" />
                      Diet Plan
                    </h3>
                    <p className="text-sm text-gray-500">Recommended nutrition for optimal health</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {wellnessPlan.diet && Object.entries(wellnessPlan.diet).map(([meal, items]) => (
                      <div 
                        key={meal} 
                        className="p-5 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-100 shadow-sm hover:shadow-md transition-all"
                      >
                        <h4 className="text-sm font-medium text-amber-800 mb-3 capitalize">
                          {meal}
                        </h4>
                        <ul className="space-y-2">
                          {items.map((item, index) => (
                            <li key={index} className="flex items-start">
                              <span className="mt-1 w-2 h-2 bg-amber-400 rounded-full mr-2 flex-shrink-0"></span>
                              <span className="text-gray-700">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exercise Section */}
                <div>
                  <div className="mb-5 border-b border-gray-100 pb-2">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-green-600" />
                      Exercise Plan
                    </h3>
                    <p className="text-sm text-gray-500">Daily physical activities for better health</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {wellnessPlan.exercise && wellnessPlan.exercise.map((item, index) => (
                      <div 
                        key={index} 
                        className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100 shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="flex items-center mb-3">
                          <div className="p-2 bg-green-100 rounded-lg mr-3">
                            <Activity className="w-4 h-4 text-green-600" />
                          </div>
                          <h4 className="font-medium text-gray-900">{item.activity}</h4>
                        </div>
                        <div className="flex justify-between flex-wrap gap-2">
                          <span className="px-3 py-1 bg-white rounded-lg text-sm text-gray-700 shadow-sm">
                            {item.duration}
                          </span>
                          <span className="px-3 py-1 bg-white rounded-lg text-sm text-gray-700 shadow-sm">
                            {item.frequency}
                          </span>
                          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            item.intensity.toLowerCase() === "low" 
                              ? "bg-green-100 text-green-800" 
                              : item.intensity.toLowerCase() === "medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}>
                            {item.intensity} intensity
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lifestyle Section */}
                <div>
                  <div className="mb-5 border-b border-gray-100 pb-2">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                      <Moon className="w-5 h-5 mr-2 text-blue-600" />
                      Lifestyle Tips
                    </h3>
                    <p className="text-sm text-gray-500">Habits to improve overall wellbeing</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {wellnessPlan.lifestyle && wellnessPlan.lifestyle.map((item, index) => {
                      const Icon = getIconComponent(item.type);
                      return (
                        <div 
                          key={index} 
                          className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="flex items-center mb-3">
                            <div className="p-2 bg-blue-100 rounded-lg mr-3">
                              <Icon className="w-4 h-4 text-blue-600" />
                            </div>
                            <h4 className="font-medium text-gray-900">{item.type}</h4>
                          </div>
                          <div className="p-3 bg-white rounded-lg shadow-sm">
                            <p className="text-gray-700">{item.tip}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Precautions Section */}
                {wellnessPlan.precautions && wellnessPlan.precautions.length > 0 && (
                  <div>
                    <div className="mb-5 border-b border-gray-100 pb-2">
                      <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
                        Precautions
                      </h3>
                      <p className="text-sm text-gray-500">Important health considerations</p>
                    </div>
                    
                    <div className="p-5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                      <ul className="space-y-3">
                        {wellnessPlan.precautions.map((item, index) => (
                          <li key={index} className="flex items-start">
                            <AlertCircle className="w-4 h-4 text-orange-600 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {/* Patient Note Section */}
                <div className="mt-8 p-5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                  <h3 className="font-medium text-gray-800 mb-2 flex items-center">
                    <Heart className="w-4 h-4 mr-2 text-purple-600" />
                    Patient Note
                  </h3>
                  <p className="text-sm text-gray-700">
                    This wellness plan is personalized based on your health assessment. 
                    Please follow these recommendations and report any difficulties during your next check-up.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientWellnessPlan;
