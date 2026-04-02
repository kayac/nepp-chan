import { client } from "~/lib/api/client";
import type {
  CreateQuestionnaireRequest,
  QuestionnaireStatus,
  UpdateQuestionnaireRequest,
} from "~/types";

type FetchQuestionnairesParams = {
  limit?: number;
  cursor?: string;
  status?: QuestionnaireStatus;
};

export const fetchQuestionnaires = async (
  params: FetchQuestionnairesParams = {},
) => {
  const { data, error } = await client.GET("/admin/questionnaires", {
    params: {
      query: {
        limit: params.limit ?? 30,
        cursor: params.cursor,
        status: params.status,
      },
    },
  });
  if (error) throw error;
  return data;
};

export const fetchQuestionnaireById = async (id: string) => {
  const { data, error } = await client.GET("/admin/questionnaires/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const createQuestionnaire = async (body: CreateQuestionnaireRequest) => {
  const { data, error } = await client.POST("/admin/questionnaires", {
    body,
  });
  if (error) throw error;
  return data;
};

export const updateQuestionnaire = async (
  id: string,
  body: UpdateQuestionnaireRequest,
) => {
  const { data, error } = await client.PUT("/admin/questionnaires/{id}", {
    params: { path: { id } },
    body,
  });
  if (error) throw error;
  return data;
};

export const deleteQuestionnaire = async (id: string) => {
  const { data, error } = await client.DELETE("/admin/questionnaires/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const sendQuestionnaireNow = async (id: string) => {
  const { data, error } = await client.POST("/admin/questionnaires/{id}/send", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const closeQuestionnaire = async (id: string) => {
  const { data, error } = await client.POST(
    "/admin/questionnaires/{id}/close",
    { params: { path: { id } } },
  );
  if (error) throw error;
  return data;
};

export const fetchQuestionnaireResults = async (id: string) => {
  const { data, error } = await client.GET(
    "/admin/questionnaires/{id}/results",
    { params: { path: { id } } },
  );
  if (error) throw error;
  return data;
};
