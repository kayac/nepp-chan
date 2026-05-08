import { createKnowledgeRepository } from "@nepp-chan/shared/api/repository/knowledge-repository";
import { API_BASE, client } from "~/lib/api/client";

const repo = createKnowledgeRepository(client, API_BASE);

export const {
  syncKnowledge,
  deleteAllKnowledge,
  fetchFiles,
  fetchFileContent,
  saveFile,
  deleteFile,
  uploadFile,
  convertFile,
  fetchUnifiedFiles,
  reconvertFile,
  getOriginalFileUrl,
} = repo;
