-- ========================================================================
-- Safey-QMS: Training Programs Migration (2026-07-25)
-- Table: training_programs (HRM training registry, ISO 13485 / MDSAP)
-- RLS: public_all policy
-- ========================================================================

CREATE TABLE IF NOT EXISTS public.training_programs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id               TEXT NOT NULL UNIQUE,
  training_name             TEXT NOT NULL,
  training_objectives       TEXT,
  training_duration         TEXT,
  trainer                   TEXT,
  trainees                  TEXT[] NOT NULL DEFAULT '{}',
  status                    TEXT NOT NULL DEFAULT 'Active'
                              CHECK (status IN ('Active', 'Inactive')),
  performance_evaluation    TEXT,
  schedule                  TEXT NOT NULL
                              CHECK (schedule IN ('Every 6 Months', 'Once a year')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- Auto-generate training_id: PLAN_HRM_TP_01, PLAN_HRM_TP_02, ...
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_training_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num INT;
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(training_id FROM 'PLAN_HRM_TP_(\d+)') AS INT)), 0)
    INTO max_num
    FROM public.training_programs;
  next_num := max_num + 1;
  RETURN 'PLAN_HRM_TP_' || LPAD(next_num::text, 2, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_training_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.training_id IS NULL OR NEW.training_id = '' THEN
    NEW.training_id := public.next_training_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_training_id ON public.training_programs;
CREATE TRIGGER trg_generate_training_id
  BEFORE INSERT ON public.training_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_training_id();

-- ------------------------------------------------------------------------
-- updated_at trigger
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_training_programs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_training_programs_updated_at ON public.training_programs;
CREATE TRIGGER trg_update_training_programs_updated_at
  BEFORE UPDATE ON public.training_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_training_programs_updated_at();

-- ------------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_training_programs_training_id
  ON public.training_programs(training_id);
CREATE INDEX IF NOT EXISTS idx_training_programs_status
  ON public.training_programs(status);

-- ------------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------------
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'training_programs' AND policyname = 'public_all'
  ) THEN
    CREATE POLICY public_all ON public.training_programs
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_programs TO anon, authenticated;

-- ------------------------------------------------------------------------
-- Seed: 34 standard HRM training programs
-- ------------------------------------------------------------------------
INSERT INTO public.training_programs
  (training_id, training_name, training_objectives, training_duration, trainer, trainees, status, performance_evaluation, schedule)
VALUES
  ('PLAN_HRM_TP_01', 'Controlling of Non-Conforming Product',
   'Training on how a non conforming product shall be handled and isolated from the production and core assembly environment. Training on where to keep the Non conforming products. Training on Plan - Control of Non-Conforming Products (Document Number-PLAN_CNP). Training on actions taken when the non-conformity is reported after and before the distribution of the product.',
   '1', 'Product Quality Lead', ARRAY['Factory Site Manager'], 'Active',
   'Evaluate if the trainee is aware of the Location where non-conforming products are to be kept. Evaluate if the trainee is aware of the procedure for handling non-conforming products. Evaluate how non-conforming products are handled. Evaluate if the trainee is aware of the actions that need to be taken before and after the product has been distributed.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_02', 'Ad hoc Training', '', '1', 'CTO', ARRAY['Product Quality Lead'], 'Active', '', 'Once a year'),
  ('PLAN_HRM_TP_03', 'CAPA',
   'Training on how CAPA shall be performed. Training on the Procedure for Corrective and Preventive actions that need to be taken. Training on CAPA forms.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate if the personnel is aware of the plan and procedure for Corrective and preventive actions. Evaluate if the personnel is aware of the CAPA forms that need to be filled as soon as a non-conformity, complaint, adverse-event, post production or production related issue is reported.',
   'Once a year'),
  ('PLAN_HRM_TP_04', 'Code of Conduct',
   'Training personnel on the code of conduct of the facility such as cleanliness protocols, clothing, restricted areas etc.',
   '1', 'Product Quality Lead', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate adherence to code of conduct; assess knowledge and application of facility protocols.', 'Once a year'),
  ('PLAN_HRM_TP_05', 'Customer Communications and Complaints',
   'Training on Customer communication and complaints. Training on the modes of communication and the process of managing a communication. Training on how the customer records are managed. Training on how to determine if it is a feedback or complaint. Training on actions that need to be taken on a complaint.',
   '1', 'Product Quality Lead', ARRAY['Head of Sales', 'Factory Site Manager'], 'Active',
   'Evaluate if the trainee is aware of how customer communications are to be handled. Evaluate if the trainee is aware of forms for gathering customer communications. Evaluate if the trainee is aware of how customer records are to be maintained.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_06', 'Device Authorization',
   'Training on the process of submitting critical design changes. Training on countries where the products can be marketed and distributed.',
   '1', 'CTO', ARRAY['Head of Sales', 'Product Quality Lead'], 'Active',
   'Evaluate if the personnel is aware of Countries where the product can be marketed. Evaluate if the Product Quality Lead is aware of the Product Changes that can lead to informing the notified body.',
   'Once a year'),
  ('PLAN_HRM_TP_07', 'Equipment Maintenance and Measuring Equipment',
   'Training on Calibration of Equipment. Training on Maintenance of the Equipment. Training on how Equipment shall be adjusted and readjusted. Training to be imparted to the staff on not to adjust the equipment without the permission of the Product Quality Lead. Training on where the records are stored.',
   '1', 'CTO', ARRAY['Product Quality Lead', 'Factory Site Manager'], 'Active',
   'Evaluate if the procedure for equipment Maintenance of measuring equipment is known. Evaluate if the personnel is aware of the calibration of the equipment and where the records of the calibrations are stored. Evaluate if the personnel is aware of the repairing and adjustment procedures of the equipment and where the records of repairing and adjustments are stored. Evaluate if the personnel is aware of the general maintenance that needs to be carried and the records that are being stored. Evaluate if the personnel is aware of the storage and handling of these equipment.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_08', 'Hygiene and sanitation',
   'Training personnel related to cleaning activities.',
   '1', 'Product Quality Lead', ARRAY['Product Quality Lead'], 'Active',
   'Assess cleanliness standards; verify understanding of hygiene protocols and safety practices.', 'Once a year'),
  ('PLAN_HRM_TP_09', 'Labeling',
   'Training personnel on labelling related activities. Training on the relevant document for Labels being used.',
   '1', 'Product Quality Lead', ARRAY['Product Quality Lead'], 'Active',
   'Verify accuracy and compliance with labeling standards; assess knowledge of document handling and updates.', 'Once a year'),
  ('PLAN_HRM_TP_10', 'Management Review',
   'Training on how management review shall be carried out and the procedure for management review.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active', '', 'Once a year'),
  ('PLAN_HRM_TP_11', 'Packaging',
   'Training personnel on packaging activities. Training on using the right packaging materials.',
   '1', 'Product Quality Lead', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate packaging quality and materials used; assess understanding of packaging requirements.', 'Once a year'),
  ('PLAN_HRM_TP_12', 'Procedure for Adverse Events and Advisory Notices',
   'Training of the procedure and plan for Procedure for Adverse Events and Advisory Notices. Training of reporting adverse events and recall of products within Canada and US FDA. Training of advisory notices to be generated.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate if the personnel is aware of the procedure and plan for Procedure for Adverse Events and Advisory Notices. Evaluate if the personnel is aware of reporting adverse events and recall of products within Canada and US FDA. Evaluate if the Personnel is aware of advisory notices to be generated.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_13', 'Procedure for data analysis',
   'Training on the plan and procedure for data analysis. Training on the various Data Analysis points. Training if the personnel is aware of the report template.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate if the trainee is aware of the procedure and plan for data analysis. Evaluate if the trainee is aware of various data analysis points from the QMS. Evaluate if the trainee is aware of the report template for data analysis.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_14', 'Procedure for Document Control',
   'Training of the plan and procedure for Document Control. Training of the process of controlling a document ie updating, creation and approval of the document. Training of how the documents are numbered. Training of the retention period of the document. Training of the access control of the documents. Training of the security and integrity of the documents. Training of the document map and is able to locate the document map. Training of releasing and publishing the document is known.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate if the personnel is aware of the plan and procedure for Document Control. Evaluate if the trainee is aware of the process of controlling a document ie updating, creation and approval of the document. Evaluate if the trainee is aware of how the documents are numbered. Evaluate if the trainee is aware of the retention period of the document. Evaluate if the trainee is aware of the access control of the documents. Evaluate if the trainee is aware of the security and integrity of the documents. Evaluate if the trainee is aware of the document map and is able to locate the document map. Evaluate that the process of releasing and publishing the document is known.',
   'Once a year'),
  ('PLAN_HRM_TP_15', 'Procedure for Human Resources',
   'Training of the Procedure for Human Resources and management. Training of Resource planning and the resource planning checklist. Training of evaluating the competence of the workforce in accordance with the Plan - Competence Assessment. Training of the training and the training programs that are to be conducted. Training of the performance evaluation that needs to be carried out.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate if the personnel is aware of the Procedure for Human Resources and management. Evaluate if the personnel is aware of Resource planning and the resource planning checklist. Evaluate if the personnel is aware of evaluating the competence of the workforce in accordance with the Plan - Competence Assessment. Evaluate if the personnel is aware of the training and the training programs that are to be conducted. Evaluate if the personnel is aware of the performance evaluation that needs to be carried out.',
   'Once a year'),
  ('PLAN_HRM_TP_16', 'Procedure for Internal Audit',
   'Training of the plan and procedure for the internal audit. Evaluate if the personnel is aware of the Plan - Internal Audit Checklist. Training of ISO 13485 and ISO 13485-MDSAP audit requirements.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate if the personnel is aware of the plan and procedure for the internal audit. Evaluate if the personnel is aware of the Plan - Internal Audit Checklist. Evaluate if the personnel is aware of ISO 13485 and ISO 13485-MDSAP audit requirements.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_17', 'Procedure for Post Market Surveillance', '',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate if the personnel is aware of the Post Market Surveillance plan and procedure. Evaluate if the personnel is aware of the Post-market clinical follow-up. Evaluate if the personnel is aware of reviewing the clinical literature on a timely basis. Evaluate if the personnel is aware of the PMS input schedule and the format of preparing the PMS report.',
   'Once a year'),
  ('PLAN_HRM_TP_18', 'Procedure for Purchase and Evaluation of Suppliers',
   'Training of the Procedure and plan for purchasing and evaluation of the suppliers. Training of the evaluation process of the supplier ie the evaluation form that needs to be filled before adding the supplier to the approved list of suppliers. Training of the list of services that are being outsourced. Training of personnel on the awareness of the impact of selecting the supplier on the product quality. Training of Purchase Quality plan and the inspection process. Training of product specifications that need to be met. Training of process of re-evaluation of a supplier. Training of product purchase process.',
   '1', 'CTO', ARRAY['Product Quality Lead', 'Supplier and Purchase Management'], 'Active',
   'Evaluate if the trainee is aware of the Procedure and plan for purchasing and evaluation of the suppliers. Evaluate if the trainee is aware of the evaluation process of the supplier ie the evaluation form that needs to be filled before adding the supplier to the approved list of suppliers. Evaluate if the trainee is aware of the list of services that are being outsourced. Evaluate if the trainee is aware of the impact of selecting the supplier on the product quality. Evaluate if the trainee is aware of the Purchase Quality plan and the inspection process. Evaluate if the trainee is aware of the product specifications that need to be met. Evaluate if the trainee is aware of the process of re-evaluation of a supplier. Evaluate if the trainee is aware of the product purchase process.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_19', 'Procedure for Risk Management',
   'Training of Relevant staff on Risk Management Procedure, Risk Management and Mitigation of the Production Process.',
   '1', 'Product Quality Lead', ARRAY['Product Quality Lead'], 'Active',
   'Assess ability to identify and mitigate risks in production; evaluate risk management procedures in practice.', 'Once a year'),
  ('PLAN_HRM_TP_20', 'Procedure for Sales',
   'Training of Procedure for Sales. Training of Process of sending offers and communication with customers. Training of process of recording customer requests and order processing. Training of various documents they are supposed to prepare and store. Training of marketing collaterals that they are supposed to use during the marketing process. Training of the flow for communication. Training of regulatory requirements. Training of use of Record - Sales Process Review, Record - Products and Approval, Record - Production Request Form, Record - Lead Generation Document, Record - Invoice Document, Record - Distribution Record, Record - Dispatch Document, Form - Internal Purchase Request.',
   '1', 'CTO', ARRAY['Head of Sales'], 'Active',
   'Evaluate if the trainee is aware of the Procedure for Sales. Evaluate if the trainee is aware of the Process of sending offers and communication with customers. Evaluate if the trainee is aware of the process of recording customer requests and order processing. Evaluate if the trainee is aware of the various documents they are supposed to prepare and store. Evaluate if the trainee is aware of the marketing collaterals that they are supposed to use during the marketing process. Evaluate if the trainee is aware of the flow for communication. Evaluate if the documents are according to the regulatory requirements. Evaluate if the personnel is aware of the Record - Sales Process Review, Record - Products and Approval, Record - Production Request Form, Record - Lead Generation Document, Record - Invoice Document, Record - Distribution Record, Record - Dispatch Document, Form - Internal Purchase Request.',
   'Once a year'),
  ('PLAN_HRM_TP_21', 'Procedure for Software Validation',
   'Training of the IQ OQ and PQ validation of software. Training of recording the version of the software being used.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate if the trainee is aware of the IQ OQ and PQ validation of software. Evaluate if the trainee is aware of recording the version of the software being used.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_22', 'Procedure for Workplace and Infrastructure',
   'Training of the Procedure - Control Of Workplace And Infrastructure. Training of Infrastructure and work environment ie hardware resources, software resources and service resources. Training of the control program for the following: 1) Cleaning Controls 2) Decontamination Controls - Cleaning and Disinfection 3) Gowning Controls - Clothing and wearables 4) Health Controls of the employee 5) Pest Controls 6) Environmental Controls 7) Entry and Exit of Goods and Personnel Controls. Training of environmental controls. Training Scope and Frequency of maintaining the cleaning controls. Training of recording the information regarding various controls in various files.',
   '1', 'CTO', ARRAY['Factory Site Manager', 'Product Quality Lead'], 'Active',
   'Evaluate if the trainee is aware of the Procedure - Control Of Workplace And Infrastructure. Evaluate if the trainee is aware of Infrastructure and work environment ie hardware resources, software resources and service resources. Evaluate if the trainee is aware of the control program for the following: 1) Cleaning Controls 2) Decontamination Controls - Cleaning and Disinfection 3) Gowning Controls - Clothing and wearables 4) Health Controls of the employee 5) Pest Controls 6) Environmental Controls 7) Entry and Exit of Goods and Personnel Controls. Evaluate if the personnel is aware of the areas of environmental controls. Evaluate if the personnel Scope and Frequency of maintaining the cleaning controls. Evaluate if the personnel is aware of recording the information regarding various controls in various files.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_23', 'Procedure of Warehousing',
   'Training of the plan and procedure of warehousing. Training of the plan of segregating the items in the warehouse to avoid product mix-up. Training personnel involved in storage activities on correct storage procedures and protocols. Training to the Team members on cleaning and maintenance of the warehouse and other areas. Training on the PROC_WHP and PLAN_WHP. Training on the location of the materials and Warehouse Mapping. Receipt of goods. Material Handling. Inventory Management. Material Placements as per Appendix A. Product Returns and Storage of Non-Conforming Products. Cleaning and Maintenance of Warehouse.',
   '1', 'CTO', ARRAY['Factory Site Manager', 'Product Quality Lead'], 'Active',
   'Evaluate if the trainee is aware of the plan and procedure of warehousing. Evaluate if the trainee is aware of the plan of segregating the items in the warehouse to avoid product mix-up.',
   'Once a year'),
  ('PLAN_HRM_TP_24', 'Procedure Product Identification and Traceability',
   'Training of Procedure Product Identification and Traceability. Training of the UDI for each products in scope. Training of recording the UDIs within the Excel file.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate if the personnel is aware of the Procedure Product Identification and Traceability. Evaluate if the personnel is aware of the UDI for each products in scope. Evaluate if the personnel is aware of recording the UDIs within the Excel file.',
   'Once a year'),
  ('PLAN_HRM_TP_25', 'Production and Service Provision',
   'Training on Production and Service Provision Procedure and Plans. Training on Work Instructions of using various process tools. Training on maintaining the process tools. Training on production process, Process Equipment, Process Manual, Quality Checks and Recording the Quality. Training on infrastructural requirements that may affect product quality. Training on the Procedure and plan. Training on the following Work Instructions: WI - Device Testing, WI - Disinfection, WI - Injection Molding, WI - Pad Printing, WI - PCB Flashing, WI - PCB Testing, WI - Product Handling, WI - Turbine Assembly, WI - Turbine Testing, WI - Turbine Wrapping, WI - Ultrasonic Welding. Training on the Production Manual. Infrastructural Requirements. Training on Process Validation.',
   '1', 'CTO', ARRAY['Product Quality Lead', 'Factory Site Manager', 'Injection Moulding Engineer'], 'Active',
   'Evaluate if trainee is aware of all the work instructions and their locations. Evaluate if the trainee is aware of the quality objectives and quality checks that are required in order to assess the non-conformity in case that happens. Evaluate if the trainee is aware of the infrastructural requirements needed to carry out the production. Evaluate if the trainee is aware of the health and safety requirements that need to be followed. Evaluate if the trainee is aware of using the following: Device Testing Jig, Disinfection Machine, Injection Molding Machine, Pad Printing Machine, PCB Flashing Machine, PCB Testing Machine, Turbine Assembly Machine, Turbine Wrapping Machine, Ultrasonic Welding Machine, Filter Wrapping Machine.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_26', 'Production and Service Provision',
   'Training on production process, Process Equipment, Process Manual, Quality Checks and Recording the Quality. Training on infrastructural requirements that may affect product quality. Training on the Procedure and plan. Training on the following Work Instructions: WI - Device Testing, WI - Disinfection, WI - PCB Testing. Training on the Production Manual. Infrastructural Requirements.',
   '', NULL, ARRAY['Production Executive'], 'Active',
   'Evaluate if trainee is aware of all the work instructions and their locations. Evaluate if the trainee is aware of the quality objectives and quality checks that are required in order to assess the non-conformity in case that happens. Evaluate if the trainee is aware of the infrastructural requirements needed to carry out the production. Evaluate if the trainee is aware of the health and safety requirements that need to be followed. Evaluate if the trainee is aware of using the following: Device Testing Jig, Disinfection Machine, PCB Testing Machine.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_27', 'Production and Service Provision',
   'WI - Pad Printing, WI - PCB Flashing, WI - Turbine Testing. Training on the Production Manual. Infrastructural Requirements.',
   '', NULL, ARRAY['Production Executive'], 'Active',
   'Evaluate if the trainee is aware of using the following: Pad printing machine, PCB flashing machine, Turbine Testing Machine.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_28', 'Production and Service Provision',
   'WI - Product Handling, WI - Turbine Assembly. Training on the Production Manual. Infrastructural Requirements.',
   '', NULL, ARRAY['Production Executive'], 'Active',
   'Evaluate if the trainee is aware of using the following: Turbine Assembly machine. Training on the production manual. Infrastructural Requirements.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_29', 'Production and Service Provision',
   'WI - Turbine Wrapping, WI - Ultrasonic Welding. Training on the Production Manual. Infrastructural Requirements.',
   '', NULL, ARRAY['Production Executive'], 'Active',
   'Evaluate if the trainee is aware of using the following: Turbine Wrapping Machine, Ultrasonic Welding Machine, Production Manual, Infrastructural Requirements.',
   'Every 6 Months'),
  ('PLAN_HRM_TP_30', 'Production Team Awareness', 'Plan - Awareness Training.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate awareness and comprehension of production goals and processes among team members.', 'Once a year'),
  ('PLAN_HRM_TP_31', 'Quality Policy',
   'Training of relevant staff on Quality Policies of the organization.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate understanding and application of quality policies; assess awareness of quality assurance practices.', 'Once a year'),
  ('PLAN_HRM_TP_32', 'Risk Management',
   'Training on Product and Production Risks. Training on Production assessment for Risks.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Evaluate understanding of different production risks and competence in risk assessment techniques.', 'Once a year'),
  ('PLAN_HRM_TP_33', 'Software Validation',
   'Training on the procedure for Software Validation. Training on the process of IQ, OQ and PQ.',
   '1', 'CTO', ARRAY['Product Quality Lead'], 'Active',
   'Assess ability to execute IQ, OQ, and PQ protocols effectively; ensure comprehension of validation procedures.', 'Once a year'),
  ('PLAN_HRM_TP_34', 'Storage and warehouse',
   'Training personnel involved in storage activities on correct storage procedures and protocols.',
   '1', 'Product Quality Lead', ARRAY['Product Quality Lead'], 'Active',
   'Check implementation of correct storage procedures; verify understanding of various location of the items kept.', 'Once a year');
