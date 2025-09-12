import React, { useState, useEffect } from 'react';
import { Calendar, Users, UserPlus, Search, Download, RefreshCw, CalendarDays } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3001/api';

function App() {
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('add');
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [empId, setEmpId] = useState('');
  const [empName, setEmpName] = useState('');
  const [attendanceType, setAttendanceType] = useState('WFO');
  const [selectedFromDate, setSelectedFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedToDate, setSelectedToDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDateRange, setIsDateRange] = useState(false);
  
  // Search states
  const [searchEmpId, setSearchEmpId] = useState('');
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [showAllRecords, setShowAllRecords] = useState(false);

  const attendanceTypes = [
    'WFO', 'WFH', 'Emergency Leave', 'Sick Leave', 
    'Planned Leave', 'Maternity Leave', 'Paternity Leave', 
    'Casual Leave', 'Annual Leave', 'Compensatory Off'
  ];

  // Check if attendance type is a leave type
  const isLeaveType = (type) => {
    return type.includes('Leave') || type === 'Compensatory Off';
  };

  // Update date range mode when attendance type changes
  useEffect(() => {
    setIsDateRange(isLeaveType(attendanceType));
    if (!isLeaveType(attendanceType)) {
      setSelectedToDate(selectedFromDate);
    }
  }, [attendanceType, selectedFromDate]);

  // API Functions
  const apiCall = async (url, options = {}) => {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await apiCall('/employees');
      setEmployees(data);
    } catch (error) {
      alert('Failed to fetch employees: ' + error.message);
    }
  };

  const fetchAllAttendance = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/attendance');
      setAttendanceRecords(data);
      setFilteredRecords(data);
    } catch (error) {
      alert('Failed to fetch attendance records: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchAllAttendance();
  }, []);

  const getDateRange = (startDate, endDate) => {
    const dates = [];
    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    while (currentDate <= lastDate) {
      dates.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };

  const handleAddAttendance = async () => {
    if (!empId || !empName) {
      alert('Please fill in all required fields');
      return;
    }

    if (isDateRange && new Date(selectedFromDate) > new Date(selectedToDate)) {
      alert('From Date cannot be later than To Date');
      return;
    }

    try {
      setLoading(true);
      
      const dates = isDateRange ? 
        getDateRange(selectedFromDate, selectedToDate) : 
        [selectedFromDate];

      if (dates.length > 1) {
        const confirmMsg = `This will create ${dates.length} attendance records from ${selectedFromDate} to ${selectedToDate}. Continue?`;
        if (!window.confirm(confirmMsg)) {
          setLoading(false);
          return;
        }
      }

      const promises = dates.map(date => {
        const attendanceData = {
          emp_id: empId,
          emp_name: empName,
          attendance_type: attendanceType,
          date: date
        };

        return apiCall('/attendance', {
          method: 'POST',
          body: JSON.stringify(attendanceData)
        });
      });

      await Promise.all(promises);

      setEmpId('');
      setEmpName('');
      setAttendanceType('WFO');
      setSelectedFromDate(new Date().toISOString().split('T')[0]);
      setSelectedToDate(new Date().toISOString().split('T')[0]);
      
      await fetchEmployees();
      if (showAllRecords) {
        await fetchAllAttendance();
      }
      
      const recordText = dates.length > 1 ? `${dates.length} attendance records` : 'Attendance record';
      alert(`${recordText} added successfully!`);
    } catch (error) {
      alert('Failed to add attendance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchEmployee = async () => {
    if (!searchEmpId) {
      alert('Please enter Employee ID');
      return;
    }

    try {
      setLoading(true);
      const data = await apiCall(`/attendance/${searchEmpId}`);
      
      if (data.length === 0) {
        alert('No records found for this Employee ID');
        setFilteredRecords([]);
      } else {
        setFilteredRecords(data);
        setShowAllRecords(false);
      }
    } catch (error) {
      alert('Failed to search employee: ' + error.message);
      setFilteredRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGetAllDetails = async () => {
    setShowAllRecords(true);
    setSearchEmpId('');
    await fetchAllAttendance();
  };

  const getAttendanceTypeColor = (type) => {
    const colors = {
      'WFO': 'bg-green-100 text-green-800',
      'WFH': 'bg-blue-100 text-blue-800',
      'Emergency Leave': 'bg-red-100 text-red-800',
      'Sick Leave': 'bg-orange-100 text-orange-800',
      'Planned Leave': 'bg-purple-100 text-purple-800',
      'Maternity Leave': 'bg-pink-100 text-pink-800',
      'Paternity Leave': 'bg-indigo-100 text-indigo-800',
      'Casual Leave': 'bg-yellow-100 text-yellow-800',
      'Annual Leave': 'bg-teal-100 text-teal-800',
      'Compensatory Off': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      alert('No data to export');
      return;
    }

    const csvContent = [
      ['Employee ID', 'Employee Name', 'Attendance Type', 'Date'],
      ...filteredRecords.map(record => [
        record.emp_id,
        record.emp_name,
        record.attendance_type,
        record.date
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_records.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
    
        {/* Main Card Container */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          padding: '30px',
          maxWidth: '450px',
          margin: '0 auto'
        }}>
          {/* Navigation Tabs */}
          <div style={{ display: 'flex', marginBottom: '30px' }}>
            <button
              onClick={() => setActiveTab('add')}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderTopLeftRadius: '8px',
                borderBottomLeftRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: activeTab === 'add' ? '#4F46E5' : '#F3F4F6',
                color: activeTab === 'add' ? 'white' : '#6B7280'
              }}
            >
              Add Attendance
            </button>
            <button
              onClick={() => setActiveTab('track')}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderTopRightRadius: '8px',
                borderBottomRightRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: activeTab === 'track' ? '#4F46E5' : '#F3F4F6',
                color: activeTab === 'track' ? 'white' : '#6B7280'
              }}
            >
              Track Attendance
            </button>
          </div>

          {/* Add Attendance Tab */}
          {activeTab === 'add' && (
            <div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: '#1F2937', 
                marginBottom: '24px', 
                textAlign: 'center' 
              }}>
                Welcome! Stay present, achieve more
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Employee ID */}
                <input
                  type="text"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  placeholder="Employee ID"
                  list="employees-list"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                  onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                />
                <datalist id="employees-list">
                  {employees.map(emp => (
                    <option key={emp.emp_id} value={emp.emp_id}>
                      {emp.name}
                    </option>
                  ))}
                </datalist>

                {/* Employee Name */}
                <input
                  type="text"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="Employee Name"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                  onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                />

                {/* Attendance Type */}
                <select
                  value={attendanceType}
                  onChange={(e) => setAttendanceType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {attendanceTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>

                {/* Date Selection */}
                {!isDateRange ? (
                  <input
                    type="date"
                    value={selectedFromDate}
                    onChange={(e) => setSelectedFromDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #E5E7EB',
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                ) : (
                  <>
                    <input
                      type="date"
                      value={selectedFromDate}
                      onChange={(e) => {
                        setSelectedFromDate(e.target.value);
                        if (new Date(e.target.value) > new Date(selectedToDate)) {
                          setSelectedToDate(e.target.value);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                    <input
                      type="date"
                      value={selectedToDate}
                      onChange={(e) => setSelectedToDate(e.target.value)}
                      min={selectedFromDate}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleAddAttendance}
                  disabled={loading}
                  style={{
                    width: '100%',
                    backgroundColor: loading ? '#9CA3AF' : '#4F46E5',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.target.style.backgroundColor = '#4338CA';
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) e.target.style.backgroundColor = '#4F46E5';
                  }}
                >
                  {loading ? 'Adding...' : 'Add Record'}
                </button>
              </div>
            </div>
          )}

          {/* Track Attendance Tab */}
          {activeTab === 'track' && (
            <div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: '#1F2937', 
                marginBottom: '24px', 
                textAlign: 'center' 
              }}>
                Track Attendance
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                {/* Search Input */}
                <input
                  type="text"
                  value={searchEmpId}
                  onChange={(e) => setSearchEmpId(e.target.value)}
                  placeholder="Enter Employee ID"
                  list="search-employees-list"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                  onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                />
                <datalist id="search-employees-list">
                  {employees.map(emp => (
                    <option key={emp.emp_id} value={emp.emp_id}>
                      {emp.name}
                    </option>
                  ))}
                </datalist>
                
                {/* Search Button */}
                <button
                  onClick={handleSearchEmployee}
                  disabled={loading}
                  style={{
                    width: '100%',
                    backgroundColor: loading ? '#9CA3AF' : '#4F46E5',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
                
                {/* Get All Button */}
                <button
                  onClick={handleGetAllDetails}
                  disabled={loading}
                  style={{
                    width: '100%',
                    backgroundColor: loading ? '#9CA3AF' : '#16A34A',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {loading ? 'Loading...' : 'Get All'}
                </button>

                {/* Export CSV Button */}
                <button
                  onClick={exportToCSV}
                  disabled={filteredRecords.length === 0}
                  style={{
                    width: '100%',
                    backgroundColor: filteredRecords.length === 0 ? '#9CA3AF' : '#6B7280',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: filteredRecords.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Download size={16} />
                  Download CSV
                </button>
              </div>

              {/* Results Table */}
              {filteredRecords.length > 0 && (
                <div style={{ 
                  overflowX: 'auto',
                  overflowY: 'auto',
                  maxHeight: '300px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px'
                }}>
                  <table style={{ 
                    width: '100%', 
                    fontSize: '14px',
                    borderCollapse: 'collapse'
                  }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F9FAFB', zIndex: 10 }}>
                      <tr style={{ 
                        backgroundColor: '#F9FAFB', 
                        borderBottom: '2px solid #E5E7EB'
                      }}>
                        <th style={{ 
                          padding: '10px 6px', 
                          textAlign: 'left', 
                          fontWeight: '600', 
                          color: '#374151'
                        }}>Employee ID</th>
                        <th style={{ 
                          padding: '10px 6px', 
                          textAlign: 'left', 
                          fontWeight: '600', 
                          color: '#374151'
                        }}>Employee Name</th>
                        <th style={{ 
                          padding: '10px 6px', 
                          textAlign: 'left', 
                          fontWeight: '600', 
                          color: '#374151'
                        }}>Attendance Type</th>
                        <th style={{ 
                          padding: '10px 6px', 
                          textAlign: 'left', 
                          fontWeight: '600', 
                          color: '#374151'
                        }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((record, index) => (
                        <tr key={record.id || index} style={{ 
                          borderBottom: '1px solid #E5E7EB'
                        }}>
                          <td style={{ padding: '10px 6px' }}>{record.emp_id}</td>
                          <td style={{ padding: '10px 6px' }}>{record.emp_name}</td>
                          <td style={{ padding: '10px 6px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: '500',
                              backgroundColor: getAttendanceTypeColor(record.attendance_type).includes('green') ? '#DCFCE7' : 
                                             getAttendanceTypeColor(record.attendance_type).includes('blue') ? '#DBEAFE' :
                                             getAttendanceTypeColor(record.attendance_type).includes('red') ? '#FEE2E2' :
                                             getAttendanceTypeColor(record.attendance_type).includes('orange') ? '#FED7AA' :
                                             getAttendanceTypeColor(record.attendance_type).includes('purple') ? '#E9D5FF' :
                                             getAttendanceTypeColor(record.attendance_type).includes('pink') ? '#FCE7F3' :
                                             getAttendanceTypeColor(record.attendance_type).includes('indigo') ? '#E0E7FF' :
                                             getAttendanceTypeColor(record.attendance_type).includes('yellow') ? '#FEF3C7' :
                                             getAttendanceTypeColor(record.attendance_type).includes('teal') ? '#CCFBF1' : '#F3F4F6',
                              color: getAttendanceTypeColor(record.attendance_type).includes('green') ? '#166534' : 
                                    getAttendanceTypeColor(record.attendance_type).includes('blue') ? '#1E40AF' :
                                    getAttendanceTypeColor(record.attendance_type).includes('red') ? '#991B1B' :
                                    getAttendanceTypeColor(record.attendance_type).includes('orange') ? '#EA580C' :
                                    getAttendanceTypeColor(record.attendance_type).includes('purple') ? '#7C3AED' :
                                    getAttendanceTypeColor(record.attendance_type).includes('pink') ? '#BE185D' :
                                    getAttendanceTypeColor(record.attendance_type).includes('indigo') ? '#4338CA' :
                                    getAttendanceTypeColor(record.attendance_type).includes('yellow') ? '#A16207' :
                                    getAttendanceTypeColor(record.attendance_type).includes('teal') ? '#0F766E' : '#374151'
                            }}>
                              {record.attendance_type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 6px' }}>{record.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* No Records Message */}
              {filteredRecords.length === 0 && !loading && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '32px 0',
                  color: '#6B7280'
                }}>
                  <p>No records found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: '#4F46E5' }} />
              <span style={{ color: '#374151' }}>Loading...</span>
            </div>
          </div>
        )}
      </div>
      
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default App;