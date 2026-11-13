// Departments released in the current version of the application.
const availableDepartments=new Set(['injection','metalisation','serigraphie','assemblage']);
export const isDepartmentAvailable=(department:string)=>availableDepartments.has(department);
