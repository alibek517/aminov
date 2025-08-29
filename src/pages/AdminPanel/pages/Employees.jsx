import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Phone,
  Calendar,
  Eye,
  Edit3,
  UserCheck,
  UserX,
  Shield,
  User,
  X,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const UserRole = {
  ADMIN: "ADMIN",
  CASHIER: "CASHIER",
  WAREHOUSE: "WAREHOUSE",
  AUDITOR: "AUDITOR",
  MARKETING: "MARKETING",
};

const Employees = ({ selectedBranchId: propSelectedBranchId }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(
    propSelectedBranchId || localStorage.getItem("selectedBranchId") || ""
  );
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    phone: "",
    role: UserRole.ADMIN,
    branchId:
      propSelectedBranchId || localStorage.getItem("selectedBranchId") || "",
    password: "",
  });
  const [formErrors, setFormErrors] = useState({});

  const departments = [
    "all",
    "Бошқарув",
    "Савдо",
    "Омбор",
    "Доставка",
    "Молия",
  ];

  // Phone number formatting function
  const formatPhoneNumber = (value) => {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("998")) {
      digits = digits.slice(3);
    }
    digits = digits.slice(0, 9);
    const match = digits.match(/(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
    const parts = match ? [match[1], match[2], match[3], match[4]].filter(Boolean) : [];
    return "+998" + (parts.length > 0 ? " " + parts.join(" ") : "");
  };

  const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No token found. Please login again.");
    }
    const headers = {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("userRole");
      localStorage.removeItem("user");
      localStorage.removeItem("userId");
      navigate("/login");
      throw new Error("Unauthorized: Session expired. Please login again.");
    }
    if (!response.ok) {
      throw new Error(await response.text() || "Request failed");
    }
    return response;
  };

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "selectedBranchId") {
        setSelectedBranchId(e.newValue || "");
        setFormData((prev) => ({ ...prev, branchId: e.newValue || "" }));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (propSelectedBranchId !== undefined) {
      setSelectedBranchId(propSelectedBranchId);
      setFormData((prev) => ({ ...prev, branchId: propSelectedBranchId }));
    }
  }, [propSelectedBranchId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersResponse, branchesResponse] = await Promise.all([
          fetchWithAuth("https://suddocs.uz/users"),
          fetchWithAuth("https://suddocs.uz/branches"),
        ]);
        const [usersData, branchesData] = await Promise.all([
          usersResponse.json(),
          branchesResponse.json(),
        ]);
        const mappedEmployees = usersData.map((user) => ({
          id: user.id.toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          name: `${user.firstName} ${user.lastName}`,
          username: user.username,
          phone: user.phone,
          position: getPositionFromRole(user.role),
          department: getDepartmentFromRole(user.role),
          salary: 4000000,
          hireDate: new Date(user.createdAt).toISOString().split("T")[0],
          status: "active",
          role: user.role,
          branchId: user.branchId,
        }));
        setEmployees(mappedEmployees);
        setBranches(branchesData);
        if (
          selectedBranchId &&
          !branchesData.some((b) => b.id.toString() === selectedBranchId)
        ) {
          setSelectedBranchId("");
          localStorage.setItem("selectedBranchId", "");
          setFormData((prev) => ({ ...prev, branchId: "" }));
        }
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedBranchId]);

  const getPositionFromRole = (role) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Администратор";
      case UserRole.CASHIER:
        return "Кассир";
      case UserRole.WAREHOUSE:
        return "Омборчи";
      case UserRole.AUDITOR:
        return "Доставкачи";
        case UserRole.MARKETING:
        return "Сотувчи";
      default:
        return "Ходим";
    }
  };

  const getDepartmentFromRole = (role) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Бошқарув";
      case UserRole.CASHIER:
        return "Савдо";
      case UserRole.WAREHOUSE:
        return "Омбор";
      case UserRole.AUDITOR:
        return "Етказиб бериш";
      case UserRole.MARKETING:
        return "Сотувчи";

      default:
        return "Бошқарув";
    }
  };

  const getBranchName = (branchId) => {
    const branch = branches.find((b) => b.id === branchId);
    return branch ? branch.name : "Номаълум";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const formattedPhone = formatPhoneNumber(value);
      setFormData((prev) => ({
        ...prev,
        [name]: formattedPhone,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: name === "branchId" ? parseInt(value) || "" : value,
      }));
    }
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.firstName.trim()) errors.firstName = "Исмингизни киритинг";
    if (!formData.lastName.trim()) errors.lastName = "Фамилиянгизни киритинг";
    if (!formData.username.trim()) errors.username = "Тўғри username киритинг";
    if (
      !formData.phone.trim() ||
      !/^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/.test(formData.phone)
    )
      errors.phone = "Тўғри телефон рақами киритинг (+998 XX XXX XX XX)";
    if (!Object.values(UserRole).includes(formData.role))
      errors.role = "Тўғри рол танланг";
    if (!formData.branchId || !branches.some((b) => b.id === formData.branchId))
      errors.branchId = "Тўғри филиал танланг";
    if (modalType === "add" && !formData.password.trim())
      errors.password = "Парол киритиш мажбурий";
    if (formData.password.trim() && formData.password.length < 6)
      errors.password = "Парол камида 6 белгидан иборат бўлиши керак";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    const employeeData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      username: formData.username,
      phone: formData.phone.replace(/\s/g, ""),
      role: formData.role,
      branchId: formData.branchId,
    };
    if (
      modalType === "add" ||
      (modalType === "edit" && formData.password.trim())
    ) {
      employeeData.password = formData.password;
    }
    try {
      let response;
      if (modalType === "add") {
        response = await fetchWithAuth("https://suddocs.uz/users", {
          method: "POST",
          body: JSON.stringify(employeeData),
        });
      } else if (modalType === "edit") {
        response = await fetchWithAuth(
          `https://suddocs.uz/users/${selectedEmployee.id}`,
          {
            method: "PUT",
            body: JSON.stringify(employeeData),
          }
        );
      }
      const updatedEmployee = await response.json();
      if (modalType === "add") {
        setEmployees((prev) => [
          ...prev,
          {
            id: updatedEmployee.id.toString(),
            firstName: updatedEmployee.firstName,
            lastName: updatedEmployee.lastName,
            name: `${updatedEmployee.firstName} ${updatedEmployee.lastName}`,
            username: updatedEmployee.username,
            phone: updatedEmployee.phone,
            position: getPositionFromRole(updatedEmployee.role),
            department: getDepartmentFromRole(updatedEmployee.role),
            salary: 4000000,
            hireDate: new Date(updatedEmployee.createdAt)
              .toISOString()
              .split("T")[0],
            status: "active",
            role: updatedEmployee.role,
            branchId: updatedEmployee.branchId,
          },
        ]);
      } else if (modalType === "edit") {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === selectedEmployee.id
              ? {
                  ...emp,
                  firstName: updatedEmployee.firstName,
                  lastName: updatedEmployee.lastName,
                  name: `${updatedEmployee.firstName} ${updatedEmployee.lastName}`,
                  username: updatedEmployee.username,
                  phone: updatedEmployee.phone,
                  role: updatedEmployee.role,
                  branchId: updatedEmployee.branchId,
                  position: getPositionFromRole(updatedEmployee.role),
                  department: getDepartmentFromRole(updatedEmployee.role),
                }
              : emp
          )
        );
      }
      closeModal();
      alert(
        `Ходим ${
          modalType === "add"
            ? "муваффақиятли қўшилди"
            : "муваффақиятли янгиланди"
        }!`
      );
    } catch (err) {
      alert(`Хато: ${err.message}`);
    }
  };

  const handleDelete = async (employee) => {
    if (!window.confirm(`Ходим ${employee.name} ни ўчиришни тасдиқланг`)) {
      return;
    }
    try {
      await fetchWithAuth(`https://suddocs.uz/users/${employee.id}`, {
        method: "DELETE",
      });
      setEmployees((prev) => prev.filter((emp) => emp.id !== employee.id));
      alert("Ходим муваффақиятли ўчирилди!");
    } catch (err) {
      alert(`Хато: ${err.message}`);
    }
  };

  const openViewModal = (employee) => {
    setSelectedEmployee(employee);
    setModalType("view");
  };

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      firstName: employee.firstName,
      lastName: employee.lastName,
      username: employee.username,
      phone: employee.phone,
      role: employee.role,
      branchId: employee.branchId,
      password: "",
    });
    setModalType("edit");
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedEmployee(null);
    setFormData({
      firstName: "",
      lastName: "",
      username: "",
      phone: "",
      role: UserRole.ADMIN,
      branchId: selectedBranchId || branches[0]?.id || "",
      password: "",
    });
    setFormErrors({});
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return "badge badge-success";
      case "inactive":
        return "badge badge-error";
      case "on_leave":
        return "badge badge-warning";
      default:
        return "badge badge-info";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "active":
        return "Фаол";
      case "inactive":
        return "Ишламайди";
      case "on_leave":
        return "Таътилда";
      default:
        return "Номаълум";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "active":
        return <UserCheck className="text-blue-600" size={20} />;
      case "inactive":
        return null;
      case "on_leave":
        return <Calendar className="text-yellow-600" size={20} />;
      default:
        return <User className="text-gray-500" size={20} />;
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case UserRole.ADMIN:
        return <Shield className="text-red-600" size={16} />;
      case UserRole.MANAGER:
        return <Shield className="text-blue-600" size={16} />;
      default:
        return <UserCheck className="text-gray-500" size={16} />;
    }
  };

  const getRoleText = (role) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Администратор";
      case UserRole.CASHIER:
        return "Кассир";
      case UserRole.WAREHOUSE:
        return "Омборчи";
      case UserRole.AUDITOR:
        return "Доставкачи";
 case UserRole.MARKETING:
        return "Сотувчи";
      default:
        return "Ходим";
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (employee.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment =
      selectedDepartment === "all" ||
      employee.department === selectedDepartment;
    const matchesBranch =
      !selectedBranchId || employee.branchId.toString() === selectedBranchId;
    return matchesSearch && matchesDepartment && matchesBranch;
  });

  const totalEmployees = filteredEmployees.length;
  const activeEmployees = filteredEmployees.filter(
    (e) => e.status === "active"
  ).length;

  if (loading) {
    return <div className="text-center py-4">Юкланмоқда...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-600">Хато: {error}</div>;
  }

  return (
    <div className="space-y-6">
      {modalType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6 relative">
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-800"
            >
              <X size={20} />
            </button>
            <h2
              className="text-xl font-semibold mb-4"
              style={{ color: "#1178f8" }}
            >
              {modalType === "add"
                ? "Янги Ходим Қўшиш"
                : modalType === "view"
                ? "Ходим Маълумотлари"
                : "Ходимни Янгилш"}
            </h2>
            {modalType === "view" ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Исм Фамилия
                  </p>
                  <p className="text-gray-900">{selectedEmployee.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Username</p>
                  <p className="text-gray-900">{selectedEmployee.username}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Телефон</p>
                  <p className="text-gray-900">{selectedEmployee.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Рол</p>
                  <p className="text-gray-900">
                    {getRoleText(selectedEmployee.role)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Филиал</p>
                  <p className="text-gray-900">
                    {getBranchName(selectedEmployee.branchId)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Лавозим</p>
                  <p className="text-gray-900">{selectedEmployee.position}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Бўлим</p>
                  <p className="text-gray-900">{selectedEmployee.department}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Иш Бошлаган Сана
                  </p>
                  <p className="text-gray-900">{selectedEmployee.hireDate}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Ҳолат</p>
                  <p className="text-gray-900">
                    {getStatusText(selectedEmployee.status)}
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Ёпиш
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Исми
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Исми"
                  />
                  {formErrors.firstName && (
                    <p className="text-red-600 text-sm mt-1">
                      {formErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Фамилияси
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Фамилияси"
                  />
                  {formErrors.lastName && (
                    <p className="text-red-600 text-sm mt-1">
                      {formErrors.lastName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Username"
                  />
                  {formErrors.username && (
                    <p className="text-red-600 text-sm mt-1">
                      {formErrors.username}
                    </p>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700">
                    Телефон
                  </label>
                  <div className="mt-1 relative">
                    <Phone
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={20}
                    />
                    <input
                      type="text"
                      name="phone"
                      max={12}
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+998 90 123 45 67"
                    />
                  </div>
                  {formErrors.phone && (
                    <p className="text-red-600 text-sm mt-1">
                      {formErrors.phone}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Парол{" "}
                    {modalType === "edit" && "(янги парол киритиш ихтиёрий)"}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={
                      modalType === "add"
                        ? "Парол"
                        : "Янги парол (агар керак бўлса)"
                    }
                  />
                  {formErrors.password && (
                    <p className="text-red-600 text-sm mt-1">
                      {formErrors.password}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Рол
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.values(UserRole).map((role) => (
                      <option key={role} value={role}>
                        {getRoleText(role)}
                      </option>
                    ))}
                  </select>
                  {formErrors.role && (
                    <p className="text-red-600 text-sm mt-1">
                      {formErrors.role}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Филиал
                  </label>
                  <select
                    name="branchId"
                    value={formData.branchId}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={selectedBranchId !== ""}
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.branchId && (
                    <p className="text-red-600 text-sm mt-1">
                      {formErrors.branchId}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Бекор қилиш
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-white rounded-lg"
                    style={{
                      backgroundColor: "#1178f8",
                      ":hover": { backgroundColor: "#0e6be6" },
                    }}
                  >
                    {modalType === "add" ? "Қўшиш" : "Янгилш"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Ходимлар Бошқаруви
          </h1>
          <p className="text-gray-500 mt-1">
            Ходимлар маълумотлари ва бошқаруви
          </p>
        </div>
        <button
          onClick={() => {
            setModalType("add");
            setFormData({
              firstName: "",
              lastName: "",
              email: "",
              phone: "",
              role: UserRole.ADMIN,
              branchId: selectedBranchId || branches[0]?.id || "",
              password: "",
            });
          }}
          className="flex items-center px-6 py-2 text-white rounded-lg"
          style={{
            backgroundColor: "#1178f8",
            ":hover": { backgroundColor: "#0e6be6" },
          }}
        >
          <Plus size={20} className="mr-2" />
          Янги Ходим
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <User className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Жами Ходимлар</p>
              <p className="text-2xl font-semibold text-gray-900">
                {totalEmployees}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <UserCheck className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Фаол Ходимлар</p>
              <p className="text-2xl font-semibold text-gray-900">
                {activeEmployees}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Ходим номи, username ёки лавозим..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex items-center">
              <Filter className="text-gray-400 mr-2" size={20} />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === "all" ? "Барча бўлимлар" : dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ходим
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Лавозим / Бўлим
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Алоқа
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Иш Бошлаган Сана
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Рол
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ҳолат
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Амаллар
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredEmployees.map((employee) => (
                <tr
                  key={employee.id}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold mr-4">
                        {employee.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {employee.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {employee.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium">
                        {employee.position}
                      </div>
                      <div className="text-sm text-gray-500">
                        {employee.department}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items center text-sm text-gray-600">
                        <span className="mr-2">@</span>
                        <span className="truncate">{employee.username}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone size={14} className="mr-2" />
                        {employee.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar size={14} className="mr-2" />
                      {employee.hireDate}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getRoleIcon(employee.role)}
                      <span className="ml-2 text-sm text-gray-700">
                        {getRoleText(employee.role)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(employee.status)}
                      <span
                        className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                          employee.status
                        )}`}
                      >
                        {getStatusText(employee.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openViewModal(employee)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(employee)}
                        className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(employee)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Employees;