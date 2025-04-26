import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Send, Trash, ChevronLeft, Calendar, Clipboard, AlertTriangle, 
  User, Pill, Clock, Plus, Search, XCircle, Check, FileText
} from "lucide-react";
import ReactMarkdown from 'react-markdown';

// Your Gemini API key should be in .env file
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "AIzaSyDI1MjHX-tTe7dHr73enLvEXR3jPUXXCbo";

// Medicine API URL for autocomplete
const MEDICINE_API_URL = "http://localhost:8080/api/medications/search";

const NewCheckup = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm your drug interaction analyzer. Please enter a new medication to check for interactions with the patient's existing prescriptions.",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef(null);
  
  // Patient information
  const [patientEmail, setPatientEmail] = useState("");
  
  // Existing prescriptions and medications
  const [existingPrescriptions, setExistingPrescriptions] = useState([]);
  const [existingMedications, setExistingMedications] = useState([]);
  
  // Medicine search & selection
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  
  // Prescription details
  const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Form animation states
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formFeedback, setFormFeedback] = useState("");
  
  // Common options for dropdowns
  const dosageOptions = {
    "Paracetamol": ["500mg", "650mg", "1000mg"],
    "Amoxicillin": ["250mg", "500mg", "875mg"],
    "Lisinopril": ["5mg", "10mg", "20mg", "40mg"],
    "Atorvastatin": ["10mg", "20mg", "40mg", "80mg"],
    "default": ["5mg", "10mg", "20mg", "50mg", "100mg"]
  };
  
  const frequencyOptions = ["Once daily", "Twice daily", "Three times daily", "Four times daily", "As needed"];
  const durationOptions = ["3 days", "5 days", "7 days", "10 days", "14 days", "30 days"];
  const timingOptions = ["Before meals", "After meals", "With meals", "Before bedtime", "Morning", "Evening", "Night", "Any time"];

  // Add a new state for doctor's analysis
  const [doctorAnalysis, setDoctorAnalysis] = useState("");
  const [doctorName, setDoctorName] = useState("");

  // Fetch user's existing prescriptions when component loads
  useEffect(() => {
    fetchPatientPrescriptions();
  }, [id]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  // Medicine search with debounce
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      searchMedicines(searchTerm);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Function to fetch patient's existing prescriptions
  const fetchPatientPrescriptions = async () => {
    try {
      const response = await fetch(`http://localhost:8080/api/prescriptions/${id}`);
      
      if (response.ok) {
        const data = await response.json();
        setExistingPrescriptions(data.prescriptions || []);
        
        // Extract medications from prescriptions
        const medications = [];
        data.prescriptions?.forEach(prescription => {
          if (prescription.medication) {
            medications.push(prescription.medication);
          }
        });
        
        setExistingMedications(medications);
        
        // Set patient email if available
        if (data.email) {
          setPatientEmail(data.email);
        }
        
        // Update the initial message to include current medications
        if (medications.length > 0) {
          setChatMessages([
            {
              role: "assistant",
              content: `Hello! I'm your drug interaction analyzer. The patient is currently taking: ${medications.join(", ")}. Please enter a new medication to check for potential interactions with these existing medications.`,
            },
          ]);
        }
      } else {
        console.error("Failed to fetch patient prescriptions");
      }
    } catch (error) {
      console.error("Error fetching patient prescriptions:", error);
    }
  };
  
  // Function to search medicines using the API
  const searchMedicines = async (query) => {
    if (!query || query.length < 2) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`${MEDICINE_API_URL}?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      // If API returns actual results, use them
      if (response.ok && data.medications) {
        setSearchResults(data.medications);
      } else {
        // Fallback demo data if API fails
        setSearchResults([
          { id: 1, name: `${query.charAt(0).toUpperCase() + query.slice(1)}`, common_dosages: ["10mg", "20mg", "40mg"] },
          { id: 2, name: `${query.charAt(0).toUpperCase() + query.slice(1)} XR`, common_dosages: ["25mg", "50mg", "100mg"] },
          { id: 3, name: `${query.charAt(0).toUpperCase() + query.slice(1)}-HC`, common_dosages: ["5mg", "15mg", "30mg"] },
        ]);
      }
    } catch (error) {
      console.error("Error searching medicines:", error);
      // Provide fallback results
      setSearchResults([
        { id: 1, name: query.charAt(0).toUpperCase() + query.slice(1), common_dosages: ["10mg", "20mg", "40mg"] },
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  // Update the callGeminiAPI function to include complete prescription history
  const callGeminiAPI = async (newMedication) => {
    setIsLoading(true);

    try {
      // Validate input
      if (!newMedication.trim()) {
        setChatMessages(prev => [...prev, {
          role: "assistant",
          content: "Please enter a valid medication name."
        }]);
        setIsLoading(false);
        return null;
      }

      const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      };

      // Get patient medical history
      let patientHistory = "No medical history available";
      let patientPrescriptions = [];
      
      try {
        // First get the patient profile data
        const historyResponse = await fetch(`http://localhost:8080/api/user/${patientEmail}`);
        if (historyResponse.ok) {
          const patientData = await historyResponse.json();
          patientHistory = patientData.medicalIssues || "No medical history available";
        }
        
        // Now get the patient's prescription history
        const prescriptionsResponse = await fetch(`http://localhost:8080/api/patient-prescriptions/${id}`);
        if (prescriptionsResponse.ok) {
          const prescriptionsData = await prescriptionsResponse.json();
          if (prescriptionsData.success && prescriptionsData.prescriptions) {
            patientPrescriptions = prescriptionsData.prescriptions;
            console.log("Retrieved prescription history:", patientPrescriptions);
          }
        }
      } catch (err) {
        console.error("Error fetching patient data:", err);
      }

      // Extract all currently prescribed medications from prescription history
      const currentMedications = [];
      
      // Get medications from prescription history
      if (patientPrescriptions && patientPrescriptions.length > 0) {
        patientPrescriptions.forEach(prescription => {
          if (prescription.medications && Array.isArray(prescription.medications)) {
            prescription.medications.forEach(med => {
              if (med.medicine && !currentMedications.includes(med.medicine)) {
                currentMedications.push(med.medicine);
              }
            });
          }
        });
      }
      
      // Add the medications that have been selected in current session
      selectedMedicines.forEach(med => {
        if (med.name && !currentMedications.includes(med.name)) {
          currentMedications.push(med.name);
        }
      });
      
      // Prepare prescription history in structured format for the prompt
      let prescriptionHistoryText = "";
      
      if (patientPrescriptions && patientPrescriptions.length > 0) {
        prescriptionHistoryText = "Patient's prescription history:\n";
        patientPrescriptions.slice(0, 5).forEach((prescription, index) => {
          prescriptionHistoryText += `\n${index + 1}. Prescription date: ${prescription.date}\n`;
          if (prescription.doctor) {
            prescriptionHistoryText += `   Doctor: ${prescription.doctor}\n`;
          }
          if (prescription.doctorAnalysis) {
            prescriptionHistoryText += `   Analysis: ${prescription.doctorAnalysis}\n`;
          }
          if (prescription.medications && prescription.medications.length > 0) {
            prescriptionHistoryText += "   Medications:\n";
            prescription.medications.forEach(med => {
              prescriptionHistoryText += `   - ${med.medicine}, ${med.dosage}, ${med.frequency}, ${med.days}\n`;
            });
          }
        });
      }

      // Format the medication query based on existing medications and patient history
      let formattedQuery = "";
      
      if (currentMedications.length > 0) {
        formattedQuery = `Patient medical history: ${patientHistory}\n\n${prescriptionHistoryText}\n\nCheck for drug interactions between the new medication '${newMedication}' and the patient's existing medications: ${currentMedications.join(", ")}. Consider how the patient's medical conditions might impact these interactions and how the new medication relates to the patient's prescription history.`;
      } else {
        formattedQuery = `Patient medical history: ${patientHistory}\n\n${prescriptionHistoryText}\n\nProvide information about the medication '${newMedication}' and potential interactions with other common medications, considering the patient's medical conditions and prescription history.`;
      }

      const data = {
        contents: [
          {
            parts: [
              {
                text: formattedQuery
              }
            ],
          }
        ],
        generationConfig,
        systemInstruction: {
          parts: [
            {
              text: 'You are a clinical assistant specializing in medication interaction analysis. Provide ONLY brief, concise responses about drug interactions. Format your response in a compact way with these sections ONLY: 1) SUMMARY (1-2 sentences max), 2) INTERACTIONS (bullet points only, each <15 words with severity), 3) KEY WARNINGS (max 2 bullets). Do not include background information about medications. Do not include lengthy explanations. Do not use markdown headers. Keep total response under 150 words. Focus on critical interactions only. If no interactions exist, simply state "No significant interactions found" followed by 1-2 monitoring recommendations.'
            }
          ]
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      const responseData = await response.json();

      if (responseData.candidates && responseData.candidates[0]?.content?.parts[0]?.text) {
        return responseData.candidates[0].content.parts[0].text;
      } else {
        console.error("Unexpected API response:", responseData);
        return "I couldn't analyze these medications. Please check the medication name and try again.";
      }
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return "I encountered an error while analyzing these medications. Please try again later.";
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle sending a message for drug interaction check
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    // Add user message to chat
    setChatMessages((prev) => [...prev, { role: "user", content: inputMessage }]);

    // Clear input field
    const messageToBeSent = inputMessage;
    setInputMessage("");

    // Get AI response for drug interaction
    const aiResponse = await callGeminiAPI(messageToBeSent);
    
    if (aiResponse) {
      // Add AI response to chat
      setChatMessages((prev) => [...prev, { role: "assistant", content: aiResponse }]);
    }
  };
  
  // Select medicine from search results
  const handleSelectMedicine = (medicine) => {
    setIsAddingNew(true);
    setSearchTerm("");
    setSearchResults([]);
    
    // Create new medicine entry with default values
    const newMedicine = {
      id: Date.now(),
      name: medicine.name,
      dosage: medicine.common_dosages ? medicine.common_dosages[0] : dosageOptions.default[0],
      frequency: frequencyOptions[0],
      duration: durationOptions[0],
      timing: timingOptions[0],
      isNew: true // Flag to apply animation
    };
    
    // Add to selected medicines list
    setSelectedMedicines(prev => [...prev, newMedicine]);
    
    // Clear the new flag after animation completes
    setTimeout(() => {
      setSelectedMedicines(prev => 
        prev.map(med => med.id === newMedicine.id ? {...med, isNew: false} : med)
      );
      setIsAddingNew(false);
    }, 500);
  };
  
  // Update medicine details
  const updateMedicineDetail = (id, field, value) => {
    setSelectedMedicines(
      selectedMedicines.map(medicine => 
        medicine.id === id ? { ...medicine, [field]: value } : medicine
      )
    );
  };
  
  // Remove a medicine from the prescription
  const removeMedicine = (id) => {
    setSelectedMedicines(selectedMedicines.filter(medicine => medicine.id !== id));
  };
  
  // Upload complete prescription to blockchain
  const handleSubmitPrescription = async () => {
    if (selectedMedicines.length === 0) {
      setFormFeedback("Please add at least one medication to the prescription");
      setTimeout(() => setFormFeedback(""), 3000);
      return;
    }

    // Check all medicines have required fields
    const isComplete = selectedMedicines.every(
      med => med.dosage && med.frequency && med.duration && med.timing
    );
    
    if (!isComplete) {
      setFormFeedback("Please complete all required fields for each medication");
      setTimeout(() => setFormFeedback(""), 3000);
      return;
    }

    setIsLoading(true);

    try {
      // Create prescription data
      const prescriptionData = {
        patient_id: id,
        patient_email: patientEmail || id + "@example.com", // Fallback email if missing
        date: prescriptionDate,
        doctorAnalysis: doctorAnalysis, // Add doctor's analysis
        doctor: doctorName, // Add doctor's name
        items: selectedMedicines.map(medicine => ({
          medicine: medicine.name,
          dosage: medicine.dosage,
          frequency: medicine.frequency,
          timing: medicine.timing || "Any time",
          days: medicine.duration
        }))
      };

      console.log("Submitting prescription data:", JSON.stringify(prescriptionData));

      // Upload to blockchain
      const response = await fetch(`http://localhost:8080/api/upload-prescription/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prescriptionData),
      });

      // Add detailed response logging
      const responseText = await response.text();
      console.log(`Server response (${response.status}):`, responseText);
      
      // Try to parse the response as JSON
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.warn("Response is not valid JSON:", responseText);
      }

      if (response.ok) {
        // Show success message
        setFormFeedback("Prescription saved successfully!");
        
        // Clear the form
        setSelectedMedicines([]);
        setPrescriptionDate(new Date().toISOString().split('T')[0]);
        setDoctorAnalysis("");
        setDoctorName("");
        
        // Refresh the patient's prescriptions
        fetchPatientPrescriptions();
        
        // Clear success message after delay
        setTimeout(() => setFormFeedback(""), 3000);
      } else {
        let errorDetail = "Failed to upload prescription";
        if (responseData && responseData.detail) {
          errorDetail = responseData.detail;
        }
        throw new Error(errorDetail);
      }
    } catch (error) {
      console.error("Error uploading prescription:", error);
      setFormFeedback(`Error: ${error.message}`);
      setTimeout(() => setFormFeedback(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Get appropriate dosage options for a medication
  const getDosageOptionsForMedicine = (medicineName) => {
    const name = medicineName.toLowerCase();
    
    // Check for exact matches with known medications
    for (const [med, options] of Object.entries(dosageOptions)) {
      if (name.includes(med.toLowerCase())) {
        return options;
      }
    }
    
    // Default dosage options
    return dosageOptions.default;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="container mx-auto px-6 py-4 flex items-center">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="mr-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">New Checkup Session</h2>
              <p className="text-sm text-gray-600">Patient ID: {id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <section className="container mx-auto px-6 py-8 relative">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

        <div className="flex flex-col md:flex-row gap-6 relative z-10">
          {/* Left Half - Drug Interaction Checker */}
          <div className="w-full md:w-1/2 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-purple-100">
            <div className="p-4 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-purple-600 to-indigo-700">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Drug Interaction Checker
              </h3>
            </div>

            {/* Current Medications Display */}
            {existingMedications.length > 0 && (
              <div className="p-3 bg-indigo-50 border-b border-indigo-100">
                <h4 className="text-sm font-medium text-indigo-800 mb-2">Current Medications:</h4>
                <div className="flex flex-wrap gap-2">
                  {existingMedications.map((med, idx) => (
                    <span key={idx} className="px-2 py-1 bg-white rounded-full text-xs border border-indigo-200 text-indigo-700">
                      {med}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Scrollable Chat Area */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 h-[450px]">
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl shadow px-4 py-3 ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-purple-600 to-indigo-700 text-white"
                        : "bg-white border border-gray-200 text-gray-800"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="markdown">
                        <ReactMarkdown>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-xl px-4 py-3 bg-white border border-gray-200 shadow">
                    <div className="flex space-x-2">
                      <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce"></div>
                      <div
                        className="h-2 w-2 bg-purple-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="h-2 w-2 bg-purple-600 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Message Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-gray-200 flex-shrink-0 bg-gray-50"
            >
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Enter a new medication to check for interactions"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className={`px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-xl shadow-md transition-all ${
                    isLoading
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:from-purple-700 hover:to-indigo-800 hover:shadow-lg"
                  }`}
                  disabled={isLoading}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>

          {/* Right Half - Medicine Prescription Form */}
          <div className="w-full md:w-1/2 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden border border-purple-100">
            <div className="p-4 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-purple-600 to-indigo-700">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Clipboard className="w-5 h-5 mr-2" />
                Medicine Prescription
              </h3>
            </div>

            {/* Prescription Form */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Prescription Date */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Prescription Date
                </label>
                <input
                  type="date"
                  value={prescriptionDate}
                  onChange={(e) => setPrescriptionDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Doctor Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  Doctor Name
                </label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Enter doctor's name"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Doctor's Analysis */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Diagnosis & Analysis
                </label>
                <textarea
                  value={doctorAnalysis}
                  onChange={(e) => setDoctorAnalysis(e.target.value)}
                  placeholder="Enter diagnostic findings, analysis, or results from this visit"
                  rows="3"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              {/* Medicine Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Pill className="w-4 h-4 inline mr-1" />
                  Search Medicine
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to search medicines..."
                    className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm"
                  />
                  
                  {isSearching && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {searchResults.map((medicine) => (
                      <div
                        key={medicine.id}
                        className="px-4 py-2 cursor-pointer hover:bg-purple-50 border-b border-gray-100 last:border-0 transition-colors"
                        onClick={() => handleSelectMedicine(medicine)}
                      >
                        <div className="font-medium text-gray-700">{medicine.name}</div>
                        {medicine.common_dosages && (
                          <div className="text-xs text-gray-500">
                            Common dosages: {medicine.common_dosages.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Selected Medicines */}
              <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <Clipboard className="w-4 h-4 mr-1" />
                  Selected Medicines
                  <span className="ml-2 bg-purple-100 text-purple-800 text-xs font-medium px-2 py-0.5 rounded-full">
                    {selectedMedicines.length}
                  </span>
                </h4>
                
                {selectedMedicines.length === 0 && (
                  <div className="bg-gray-50 border border-gray-200 border-dashed rounded-lg p-6 text-center">
                    <div className="text-gray-400">
                      <Pill className="w-8 h-8 mx-auto mb-2" />
                      <p>No medicines added yet.</p>
                      <p className="text-sm mt-1">Search and select medicines above.</p>
                    </div>
                  </div>
                )}
                
                {/* Medicine Cards */}
                <div className="space-y-4">
                  {selectedMedicines.map((medicine) => (
                    <div 
                      key={medicine.id} 
                      className={`bg-white border rounded-lg shadow-sm overflow-hidden transition-all duration-300 
                               ${medicine.isNew ? 'animate-slide-in border-green-400' : 'border-gray-200'}`}
                    >
                      {/* Medicine Card Header */}
                      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-100">
                        <h5 className="font-medium text-gray-800">{medicine.name}</h5>
                        <button 
                          onClick={() => removeMedicine(medicine.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                      
                      {/* Medicine Card Body */}
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Dosage */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Dosage</label>
                            <select
                              value={medicine.dosage}
                              onChange={(e) => updateMedicineDetail(medicine.id, 'dosage', e.target.value)}
                              className="w-full p-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-purple-400 focus:border-purple-400 bg-gray-50 text-sm"
                            >
                              {getDosageOptionsForMedicine(medicine.name).map((dose) => (
                                <option key={dose} value={dose}>{dose}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Frequency */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
                            <select
                              value={medicine.frequency}
                              onChange={(e) => updateMedicineDetail(medicine.id, 'frequency', e.target.value)}
                              className="w-full p-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-purple-400 focus:border-purple-400 bg-gray-50 text-sm"
                            >
                              {frequencyOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Duration */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
                            <select
                              value={medicine.duration}
                              onChange={(e) => updateMedicineDetail(medicine.id, 'duration', e.target.value)}
                              className="w-full p-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-purple-400 focus:border-purple-400 bg-gray-50 text-sm"
                            >
                              {durationOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Timing */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Timing</label>
                            <select
                              value={medicine.timing}
                              onChange={(e) => updateMedicineDetail(medicine.id, 'timing', e.target.value)}
                              className="w-full p-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-purple-400 focus:border-purple-400 bg-gray-50 text-sm"
                            >
                              {timingOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Feedback message */}
              {formFeedback && (
                <div className={`mb-4 p-3 rounded-lg text-sm transition-all ${
                  formFeedback.includes("Error") 
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-green-50 text-green-700 border border-green-200"
                }`}>
                  <div className="flex items-center">
                    {formFeedback.includes("Error") ? (
                      <AlertTriangle className="w-4 h-4 mr-2" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    {formFeedback}
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-gray-50">
              {/* Add New Medicine Button */}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="flex-1 px-4 py-3 bg-white border border-purple-500 text-purple-700 rounded-xl hover:bg-purple-50 transition-colors flex items-center justify-center"
                  disabled={isLoading || isAddingNew}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Medicine
                </button>
                
                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleSubmitPrescription}
                  className={`flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-xl shadow-md transition-all ${
                    isLoading || selectedMedicines.length === 0
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:from-purple-700 hover:to-indigo-800 hover:shadow-lg"
                  }`}
                  disabled={isLoading || selectedMedicines.length === 0}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Check className="w-5 h-5 mr-2" />
                      Submit Prescription
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default NewCheckup;