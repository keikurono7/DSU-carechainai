import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Unlock, ChevronLeft, AlertCircle, CheckCircle } from "lucide-react";

const AddPatient = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    accessCode: "",
  });
  const [doctorEmail, setDoctorEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Get doctor's email from localStorage on component mount
  useEffect(() => {
    const email = localStorage.getItem("userEmail");
    if (email) {
      setDoctorEmail(email);
    } else {
      setError("Please login again to add patients");
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const linkData = {
        patient_email: formData.email,
        access_code: formData.accessCode,
        doctor_email: doctorEmail
      };

      const response = await fetch("http://localhost:8080/api/doctor/link-patient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(linkData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to link to patient");
      }

      setSuccess({
        message: "Successfully linked to patient",
        patientId: data.userId,
        patientName: data.name,
        email: data.patient_email
      });
      
      setFormData({
        email: "",
        accessCode: ""
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
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
          onClick={() => navigate("/patients")}
          className="mb-6 inline-flex items-center px-3 py-2 bg-white rounded-xl shadow-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Patients
        </button>
        
        {/* Main content */}
        <div className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-700">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Unlock className="w-5 h-5 mr-2" />
              Link to Existing Patient
            </h2>
          </div>
          
          <div className="p-6">
            {/* Success message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-green-800">{success.message}</h3>
                  <p className="text-sm text-green-600 mt-1">
                    Patient linked successfully: {success.patientName}
                  </p>
                  <div className="mt-2 p-3 bg-white rounded-lg border border-green-100">
                    <p className="text-sm font-medium text-gray-700">
                      Patient ID: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{success.patientId}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      You now have access to this patient's medical records.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Error message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-red-800">Error linking to patient</h3>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}
            
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                {/* Email field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Email*
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="patient@example.com"
                  />
                </div>
                
                {/* Access Code field */}
                <div>
                  <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Access Code*
                  </label>
                  <input
                    id="accessCode"
                    name="accessCode"
                    type="text"
                    required
                    value={formData.accessCode}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Patient's access code"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The access code is provided to patients and required to link their account
                  </p>
                </div>
                
                {/* Doctor email field - pre-filled and readonly */}
                <div>
                  <label htmlFor="doctor_email" className="block text-sm font-medium text-gray-700 mb-1">
                    Doctor Email
                  </label>
                  <input
                    id="doctor_email"
                    type="email"
                    value={doctorEmail}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-gray-50"
                  />
                </div>
              </div>
              
              {/* Submit button */}
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isLoading || !doctorEmail}
                  className={`px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center
                    ${(isLoading || !doctorEmail) ? 'opacity-50 cursor-not-allowed' : 'hover:from-purple-700 hover:to-indigo-800'}`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Linking to Patient...
                    </>
                  ) : (
                    <>
                      <Unlock className="w-5 h-5 mr-2" />
                      Link to Patient
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPatient;