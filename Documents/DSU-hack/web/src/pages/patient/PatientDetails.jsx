import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, Calendar, Heart, ChevronLeft, Clock, User, Users, Loader, AlertCircle, Download, Activity, Plus } from "lucide-react";

const PatientDetails = () => {
  const { id } = useParams(); // 'id' is now actually the username from email
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [patientPrescriptions, setPatientPrescriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch patient data from blockchain based on username
  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        setIsLoading(true);
        
        // Your existing code to fetch patient data...
        try {
          const response = await fetch("http://localhost:8080/api/patients");
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          
          const data = await response.json();
          
          // Find the patient with matching username
          const patientData = data.find(item => {
            const userData = JSON.parse(hexToUtf8(item.data));
            const username = userData.email ? userData.email.split('@')[0] : "unknown";
            return username === id;
          });
          
          if (!patientData) {
            throw new Error("Patient not found");
          }
          
          // Parse the patient data
          const userData = JSON.parse(hexToUtf8(patientData.data));
          
          // Set the patient state with actual data
          setPatient({
            id: userData.userId || "Unknown",
            username: id,
            name: userData.name || "Unknown",
            age: userData.age || "N/A",
            email: userData.email || "N/A",
            gender: userData.gender || "N/A",
            bloodGroup: userData.bloodGroup || "N/A",
            medicalIssues: userData.medicalIssues || "None",
            lastVisit: "2024-04-10", // Default as not provided in blockchain data
            nextCheckup: "2024-04-20", // Default as not provided in blockchain data
            riskLevel: userData.medicalIssues?.toLowerCase().includes("diabet") ? "High" : "Low"
          });
        } catch (err) {
          console.error("Failed to fetch patient:", err);
          setError(err.message);
          
          // Fallback to dummy data if API fails
          setPatient({
            id: "Unknown",
            username: id,
            name: "John Doe",
            age: 45,
            lastVisit: "2024-04-10",
            nextCheckup: "2024-04-20",
            riskLevel: "Low",
            bloodGroup: "A+",
            medicalIssues: "None",
          });
        }
        
        // Add code to fetch prescriptions
        try {
          const prescriptionsResponse = await fetch(`http://localhost:8080/api/patient-prescriptions/${id}`);
          if (prescriptionsResponse.status === 404) {
            // If stream doesn't exist yet (no prescriptions), just set empty array
            console.log(`No prescriptions found for patient ${id}, stream probably doesn't exist yet`);
            setPatientPrescriptions([]);
          } else if (prescriptionsResponse.ok) {
            const prescriptionsData = await prescriptionsResponse.json();
            console.log("Prescription API response:", prescriptionsData); 
            if (prescriptionsData.prescriptions) {
              setPatientPrescriptions(prescriptionsData.prescriptions);
            } else {
              console.warn("API returned but no prescriptions data", prescriptionsData);
              setPatientPrescriptions([]);
            }
          } else {
            // For other errors, log them
            console.error(`Failed to fetch prescriptions, status: ${prescriptionsResponse.status}`);
            const errorText = await prescriptionsResponse.text();
            console.error(`Error details: ${errorText}`);
            setPatientPrescriptions([]);
          }
        } catch (err) {
          console.error("Failed to fetch prescriptions:", err);
          setPatientPrescriptions([]);
        }
        
      } catch (err) {
        console.error("Failed to fetch patient:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatientData();
  }, [id]);

  // Helper function to convert hex to UTF-8 string
  const hexToUtf8 = (hex) => {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  };

  // Breadcrumb navigation helper
  const BreadcrumbNav = () => (
    <div className="flex items-center space-x-2 text-sm text-gray-600">
      <button
        onClick={() => navigate("/patients")}
        className="hover:text-purple-700 transition-colors flex items-center"
      >
        <Users className="w-3 h-3 mr-1" />
        Patients
      </button>
      <span>/</span>
      <span className="text-gray-800 font-medium">{patient?.name || 'Loading...'}</span>
    </div>
  );

  // Updated action cards array without Schedule Checkup
  const actionCards = [
    {
      icon: Clock,
      title: "New Checkup",
      description: "Start a new checkup session with the patient",
      path: "new-checkup",
      pageName: "New Checkup Session",
      gradientFrom: "from-cyan-500",
      gradientTo: "to-blue-600",
    },
    {
      icon: FileText,
      title: "Risk Report",
      description: "View detailed health risk assessment",
      path: "risk-report",
      pageName: "Patient Risk Assessment",
      gradientFrom: "from-amber-500",
      gradientTo: "to-orange-600",
    },
    {
      icon: Heart,
      title: "Wellness Plan",
      description: "View personalized health recommendations",
      path: "wellness-plan",
      pageName: "Patient Wellness Plan",
      gradientFrom: "from-purple-600",
      gradientTo: "to-indigo-700",
    },
  ];

  // Action card component with page title management
  const ActionCard = ({ icon: Icon, title, description, path, pageName, gradientFrom, gradientTo }) => (
    <div
      onClick={() => {
        // Store the current page name for back navigation
        sessionStorage.setItem("previousPage", "Patient Details");
        sessionStorage.setItem("currentPage", pageName);
        // Use username (stored in 'id' param) for navigation
        navigate(`/patients/${id}/${path}`);
      }}
      className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer"
    >
      <div className={`px-6 py-4 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}>
        <h3 className="text-lg font-medium text-white flex items-center">
          <Icon className="w-5 h-5 mr-2" />
          {title}
        </h3>
      </div>
      
      <div className="p-5">
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  );

  const PrescriptionHistory = ({ prescriptions }) => {
    if (!prescriptions || prescriptions.length === 0) {
      return (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No prescription history available</p>
        </div>
      );
    }

    // Format date to readable format
    const formatDate = (dateString) => {
      if (!dateString) return "No date";
      
      try {
        const date = new Date(dateString);
        if (isNaN(date)) return dateString;
        
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      } catch (e) {
        return dateString;
      }
    };

    return (
      <div className="space-y-4">
        {prescriptions.map((prescription, index) => (
          <div 
            key={index}
            className="bg-white rounded-lg border border-purple-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Prescription Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 flex justify-between items-center">
              <div className="flex items-center">
                <div className="rounded-full mr-3 p-2 bg-white shadow-sm">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">
                    {prescription.id || "Prescription"}
                  </h4>
                  <div className="text-xs text-gray-600 mt-0.5 flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(prescription.date)}
                  </div>
                </div>
              </div>
              
              {prescription.doctor && (
                <div className="text-sm text-gray-600">
                  Dr. {prescription.doctor}
                </div>
              )}
            </div>
            
            {/* Prescription Body - Medications */}
            <div className="p-4">
              <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Activity className="w-4 h-4 mr-1 text-purple-600" />
                Medications
              </h5>
              
              <div className="space-y-2">
                {prescription.medications && prescription.medications.map((med, midx) => (
                  <div key={midx} className="flex items-start bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium">{med.medicine}</p>
                      <p className="text-xs text-gray-600">
                        {med.dosage}, {med.frequency}, {med.timing || "Any time"}, for {med.days}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Doctor's Analysis */}
              {prescription.doctorAnalysis && (
                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <FileText className="w-4 h-4 mr-1 text-purple-600" />
                    Doctor's Analysis
                  </h5>
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-sm text-gray-700">
                    <p className="italic">{prescription.doctorAnalysis}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Prescription Footer */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <div className="flex items-center text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5 mr-1" />
                Added {formatDate(prescription.created_at || prescription.date)}
              </div>
              
              <div>
                <button className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full border border-purple-200 transition-colors flex items-center">
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg flex items-center space-x-4">
          <Loader className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-gray-600">Loading patient data...</p>
        </div>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Patient Not Found</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/patients")}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-xl shadow-md"
          >
            Return to Patients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8 px-6 relative">
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      
      <div className="container mx-auto relative z-10 space-y-6">
        {/* Back button */}
        <button 
          onClick={() => navigate("/patients")}
          className="mb-4 inline-flex items-center px-3 py-2 bg-white rounded-xl shadow-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Patients
        </button>
        
        {/* Header with Breadcrumb Navigation */}
        <div className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-700">
            <BreadcrumbNav />
          </div>
          
          <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div className="mb-4 md:mb-0">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <User className="w-6 h-6 mr-2 text-purple-600" />
                  {patient.name}
                </h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm text-gray-700">Username: {patient.username}</span>
                  <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm text-gray-700">Age: {patient.age}</span>
                  <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm text-gray-700">Blood Group: {patient.bloodGroup}</span>
                  <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm text-gray-700">Last Visit: {patient.lastVisit}</span>
                </div>
              </div>
              
              <span
                className={`px-4 py-2 rounded-xl text-sm font-medium ${
                  patient.riskLevel === "High"
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {patient.riskLevel} Risk
              </span>
            </div>
          </div>
        </div>

        {/* Prescription History Card */}
        <div className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-violet-600 to-purple-700">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Prescription History
            </h2>
          </div>
          <div className="p-6">
            <PrescriptionHistory prescriptions={patientPrescriptions} />

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => navigate(`/patients/${id}/new-checkup`)}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
              >
                Add New Prescription
                <Plus className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {actionCards.map((card, index) => (
            <ActionCard key={index} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PatientDetails;
